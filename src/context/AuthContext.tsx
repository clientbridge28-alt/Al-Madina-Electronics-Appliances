import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, authorizedApiFetch, db, handleFirestoreError, OperationType, testConnection } from '../services/firebase';
import {
  buildFullOwnerPermissions,
  getDefaultPermissionsForRole,
  ORG_ID,
  OWNER_EMAIL,
  type ModulePermissionKey,
  type PermissionAction,
  type PermissionsMatrix,
} from '../types/rbac';
import type { User } from '../types/erp';
import {
  applyCloudCollectionSnapshot,
  clearCloudSession,
  isDemoMode,
  seedDemoData,
  setCloudSessionUser,
  setDemoMode as setStorageDemoMode,
} from '../services/storage';
import { attachPermittedCloudListeners, persistUserSession } from '../services/firestoreSync';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'needs_verification'
  | 'needs_mfa'
  | 'suspended'
  | 'no_staff_profile'
  | 'authenticated'
  | 'demo';

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  staffUser: User | null;
  isOwner: boolean;
  isDemoSession: boolean;
  authError: string | null;
  connectionStatus: { online: boolean; message: string };
  mfaPending: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  resendVerificationEmail: () => Promise<{ ok: boolean; message: string }>;
  requestMfaCode: () => Promise<{ ok: boolean; message: string }>;
  verifyMfaCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  reauthenticateOwner: () => Promise<boolean>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  logout: () => Promise<void>;
  can: (moduleKey: ModulePermissionKey, action?: PermissionAction) => boolean;
  notifyOwnerSecurityEvent: (payload: { type: string; severity?: 'INFO' | 'WARNING' | 'CRITICAL'; title: string; details: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_ID_KEY = 'almadina_session_id_v1';

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = `SESS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    return `SESS-${Date.now()}`;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>(isDemoMode() ? 'demo' : 'loading');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [staffUser, setStaffUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mfaPending, setMfaPending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ online: boolean; message: string }>({
    online: false,
    message: 'Checking Cloud Firestore connectivity...',
  });

  const cloudListenersUnsubRef = useRef<(() => void) | null>(null);
  const userDocUnsubRef = useRef<(() => void) | null>(null);
  const sessionUnsubRef = useRef<(() => void) | null>(null);
  const mfaVerifiedUidRef = useRef<string | null>(null);

  const cleanupSubscriptions = () => {
    cloudListenersUnsubRef.current?.();
    cloudListenersUnsubRef.current = null;
    userDocUnsubRef.current?.();
    userDocUnsubRef.current = null;
    sessionUnsubRef.current?.();
    sessionUnsubRef.current = null;
  };

  useEffect(() => {
    testConnection().then(setConnectionStatus).catch(() => {});
  }, []);

  const notifyOwnerSecurityEvent = async (payload: {
    type: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    details: string;
  }) => {
    try {
      await authorizedApiFetch('/api/notifications/owner', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-blocking if offline
    }
  };

  const bootstrapOwnerIfNeeded = async (fbUser: FirebaseUser): Promise<User | null> => {
    if (!db) return null;
    const email = (fbUser.email || '').toLowerCase();
    const userRef = doc(db, 'users', fbUser.uid);

    if (email === OWNER_EMAIL && fbUser.emailVerified) {
      const adminRef = doc(db, 'admins', fbUser.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: fbUser.uid,
          email: fbUser.email,
          role: 'Owner',
          createdAt: new Date().toISOString(),
        });
      }
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const ownerProfile: User = {
          id: fbUser.uid,
          uid: fbUser.uid,
          orgId: ORG_ID,
          name: fbUser.displayName || 'Muhammad Tariq Khan (Owner)',
          email: fbUser.email || OWNER_EMAIL,
          role: 'Owner',
          phone: '',
          active: true,
          suspended: false,
          emailVerified: true,
          mfaEnabled: false,
          sessionVersion: 1,
          permissions: buildFullOwnerPermissions(),
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userRef, ownerProfile);
        return ownerProfile;
      }
    }

    const snap = await getDoc(userRef);
    return snap.exists() ? (snap.data() as User) : null;
  };

  const activateStaffSession = async (fbUser: FirebaseUser, profile: User) => {
    const isOwnerAccount = profile.role === 'Owner' || (fbUser.email || '').toLowerCase() === OWNER_EMAIL;
    const effectivePermissions: PermissionsMatrix = isOwnerAccount
      ? buildFullOwnerPermissions()
      : profile.permissions && Object.keys(profile.permissions).length > 0
      ? profile.permissions
      : getDefaultPermissionsForRole(profile.role);

    const hydratedUser: User = {
      ...profile,
      uid: fbUser.uid,
      id: fbUser.uid,
      orgId: ORG_ID,
      permissions: effectivePermissions,
      lastLogin: new Date().toISOString(),
    };

    setStaffUser(hydratedUser);
    setCloudSessionUser(hydratedUser);

    if (profile.mfaEnabled && mfaVerifiedUidRef.current !== fbUser.uid) {
      setMfaPending(true);
      setStatus('needs_mfa');
      return;
    }
    setMfaPending(false);

    const sessionId = getOrCreateSessionId();
    try {
      await persistUserSession({
        id: sessionId,
        orgId: ORG_ID,
        uid: fbUser.uid,
        email: fbUser.email || profile.email,
        userName: profile.name,
        role: profile.role,
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : 'Web Browser',
        revoked: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });
    } catch {
      // ignore session write issues
    }

    cloudListenersUnsubRef.current?.();
    cloudListenersUnsubRef.current = attachPermittedCloudListeners(
      fbUser.uid,
      isOwnerAccount,
      effectivePermissions,
      {
        onCollectionUpdate: (col, docs) => applyCloudCollectionSnapshot(col, docs),
        onSyncError: err => console.error('Cloud sync error:', err),
      }
    );

    if (db) {
      sessionUnsubRef.current?.();
      sessionUnsubRef.current = onSnapshot(doc(db, 'sessions', sessionId), snap => {
        if (snap.exists() && snap.data()?.revoked === true) {
          setAuthError('Your session was revoked by the Owner Administrator.');
          signOut(auth!).catch(() => {});
        }
      });
    }

    setStatus('authenticated');
  };

  useEffect(() => {
    if (isDemoMode()) {
      seedDemoData();
      setStatus('demo');
      return;
    }

    if (!auth) {
      setStatus('unauthenticated');
      return;
    }

    const unsubAuth = onAuthStateChanged(auth, async fbUser => {
      cleanupSubscriptions();
      setAuthError(null);

      if (isDemoMode()) {
        setStatus('demo');
        return;
      }

      if (!fbUser) {
        mfaVerifiedUidRef.current = null;
        setMfaPending(false);
        setFirebaseUser(null);
        setStaffUser(null);
        clearCloudSession();
        setStatus('unauthenticated');
        return;
      }

      setFirebaseUser(fbUser);

      if (!fbUser.emailVerified) {
        setStatus('needs_verification');
        return;
      }

      try {
        const profile = await bootstrapOwnerIfNeeded(fbUser);
        if (!profile) {
          setStatus('no_staff_profile');
          return;
        }

        if ((profile.suspended || !profile.active) && (fbUser.email || '').toLowerCase() !== OWNER_EMAIL) {
          setStaffUser(profile);
          setStatus('suspended');
          return;
        }

        await activateStaffSession(fbUser, profile);
        notifyOwnerSecurityEvent({
          type: 'USER_LOGIN',
          severity: 'INFO',
          title: `Staff Sign-In: ${profile.name}`,
          details: `${fbUser.email} signed into Al-Madina ERP (${profile.role}).`,
        });

        // Watch live updates to own user profile (instant suspension or permission update)
        if (db) {
          userDocUnsubRef.current = onSnapshot(
            doc(db, 'users', fbUser.uid),
            snap => {
              if (!snap.exists()) return;
              const updated = snap.data() as User;
              if ((updated.suspended || !updated.active) && (fbUser.email || '').toLowerCase() !== OWNER_EMAIL) {
                setStaffUser(updated);
                setStatus('suspended');
                cleanupSubscriptions();
                return;
              }
              setStaffUser(updated);
              setCloudSessionUser(updated);
            },
            err => handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`)
          );
        }
      } catch (err: any) {
        setAuthError(err?.message || 'Failed to load staff security profile.');
        setStatus('unauthenticated');
      }
    });

    return () => {
      unsubAuth();
      cleanupSubscriptions();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Firebase Auth is not initialized.');
    setAuthError(null);
    setStorageDemoMode(false);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth is not initialized.');
    setAuthError(null);
    setStorageDemoMode(false);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication -> Sign-in method -> Email/Password). Use Google Sign-In or enable Email/Password in Firebase Console.'
        );
      }
      throw err;
    }
  };

  const requestPasswordReset = async (email: string) => {
    if (!auth) return { ok: false, message: 'Firebase Auth unavailable.' };
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true, message: `Password reset email dispatched to ${email}.` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Unable to dispatch password reset email.' };
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth?.currentUser) return { ok: false, message: 'No active signed-in user.' };
    try {
      await sendEmailVerification(auth.currentUser);
      return { ok: true, message: `Verification email sent to ${auth.currentUser.email}.` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Could not send verification email.' };
    }
  };

  const requestMfaCode = async () => {
    const res = await authorizedApiFetch('/api/mfa/request', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: data.error || 'MFA email dispatch failed.' };
    return { ok: true, message: '6-digit verification code sent to your email.' };
  };

  const verifyMfaCode = async (code: string) => {
    const res = await authorizedApiFetch('/api/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.verified) {
      return { ok: false, message: data.error || 'Invalid verification code.' };
    }
    if (firebaseUser) {
      mfaVerifiedUidRef.current = firebaseUser.uid;
    }
    setMfaPending(false);
    if (firebaseUser && staffUser) {
      await activateStaffSession(firebaseUser, staffUser);
    } else {
      setStatus('authenticated');
    }
    return { ok: true, message: 'MFA verification succeeded.' };
  };

  const reauthenticateOwner = async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    try {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(auth.currentUser, provider);
      return true;
    } catch {
      return false;
    }
  };

  const enterDemoMode = () => {
    cleanupSubscriptions();
    clearCloudSession();
    setStorageDemoMode(true);
    seedDemoData();
    setStatus('demo');
  };

  const exitDemoMode = () => {
    setStorageDemoMode(false);
    setStatus(firebaseUser ? 'authenticated' : 'unauthenticated');
  };

  const logout = async () => {
    cleanupSubscriptions();
    mfaVerifiedUidRef.current = null;
    setMfaPending(false);
    setStorageDemoMode(false);
    clearCloudSession();
    setStaffUser(null);
    if (auth) {
      await signOut(auth);
    }
    setStatus('unauthenticated');
  };

  const isDemoSession = status === 'demo';
  const isOwner = Boolean(
    !isDemoSession &&
      staffUser &&
      (staffUser.role === 'Owner' || (firebaseUser?.email || '').toLowerCase() === OWNER_EMAIL)
  );

  const can = (moduleKey: ModulePermissionKey, action: PermissionAction = 'VIEW'): boolean => {
    if (isDemoSession) {
      return moduleKey !== 'admin' && (action === 'VIEW' || action === 'EXPORT');
    }
    if (!staffUser || status !== 'authenticated') return false;
    if (isOwner) return true;
    const actions = staffUser.permissions?.[moduleKey];
    return Array.isArray(actions) && actions.includes(action);
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        firebaseUser,
        staffUser,
        isOwner,
        isDemoSession,
        authError,
        connectionStatus,
        mfaPending,
        signInWithGoogle,
        signInWithEmail,
        requestPasswordReset,
        resendVerificationEmail,
        requestMfaCode,
        verifyMfaCode,
        reauthenticateOwner,
        enterDemoMode,
        exitDemoMode,
        logout,
        can,
        notifyOwnerSecurityEvent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
