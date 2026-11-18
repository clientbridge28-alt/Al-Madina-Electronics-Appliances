import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  authorizedApiFetch,
  db,
  getFirebaseMissingFields,
  isFirebaseConfigured,
  testConnection,
} from '../services/firebase';
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
  setCloudSessionUser,
} from '../services/storage';
import { attachPermittedCloudListeners } from '../services/firestoreSync';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  staffUser: User | null;
  isOwner: boolean;
  authError: string | null;
  connectionStatus: { online: boolean; message: string };
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  reauthenticateOwner: () => Promise<boolean>;
  logout: () => Promise<void>;
  can: (moduleKey: ModulePermissionKey, action?: PermissionAction) => boolean;
  notifyOwnerSecurityEvent: (payload: {
    type: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    details: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function mapFirebaseAuthError(
  err: unknown,
  method: 'google' | 'email' | 'reset' = 'email'
): string {
  const errorObj = err as { code?: string; message?: string } | null;
  const code = typeof errorObj?.code === 'string' ? errorObj.code : '';
  const msg = typeof errorObj?.message === 'string' ? errorObj.message : '';

  if (code === 'auth/configuration-missing' || msg.includes('Firebase Configuration Missing')) {
    return 'Firebase Configuration Missing: Configure your VITE_FIREBASE_* environment variables.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network Error: Unable to reach Firebase Authentication. Please check your internet connection.';
  }

  if (method === 'google') {
    if (code === 'auth/popup-closed-by-user') {
      return 'Google Sign-In Failed: Sign-in popup was closed before completing login.';
    }
    if (code === 'auth/cancelled-popup-request') {
      return 'Google Sign-In Failed: Previous sign-in popup was cancelled. Please try again.';
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Google Sign-In Failed: Domain "${host}" is not authorized in Firebase Authentication settings.`;
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Google Sign-In Failed: Google Sign-In is not enabled in Firebase Console.';
    }
    return `Google Sign-In Failed: ${msg || 'Unable to sign in with Google.'}`;
  }

  if (code === 'auth/invalid-email') {
    return 'Invalid Email: Please enter a valid email address.';
  }

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Wrong Password: Invalid email or password.';
  }

  if (code === 'auth/user-not-found') {
    return method === 'reset'
      ? 'Invalid Email: No account found with this email address.'
      : 'Wrong Password: Invalid email or password.';
  }

  if (code === 'auth/user-disabled') {
    return 'This user account has been disabled in Firebase Authentication.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled in Firebase Console.';
  }

  return msg || 'Authentication failed. Please try again.';
}

function buildFallbackStaffProfile(fbUser: FirebaseUser): User {
  const email = (fbUser.email || '').trim();
  const isOwnerEmail = email.toLowerCase() === OWNER_EMAIL;
  const role = isOwnerEmail ? 'Owner' : 'Manager';
  const permissions: PermissionsMatrix = isOwnerEmail
    ? buildFullOwnerPermissions()
    : getDefaultPermissionsForRole('Manager');

  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    orgId: ORG_ID,
    name: fbUser.displayName || email.split('@')[0] || 'Showroom User',
    email,
    role,
    phone: fbUser.phoneNumber || '',
    active: true,
    suspended: false,
    emailVerified: fbUser.emailVerified,
    mfaEnabled: false,
    sessionVersion: 1,
    permissions,
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [staffUser, setStaffUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ online: boolean; message: string }>({
    online: false,
    message: 'Checking Cloud Firestore connectivity...',
  });

  const cloudListenersUnsubRef = useRef<(() => void) | null>(null);
  const userDocUnsubRef = useRef<(() => void) | null>(null);

  const cleanupSubscriptions = () => {
    cloudListenersUnsubRef.current?.();
    cloudListenersUnsubRef.current = null;
    userDocUnsubRef.current?.();
    userDocUnsubRef.current = null;
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
      // Non-blocking if backend/network unavailable
    }
  };

  const activateAuthenticatedSession = (fbUser: FirebaseUser, profile: User) => {
    const isOwnerAccount =
      profile.role === 'Owner' || (fbUser.email || '').toLowerCase() === OWNER_EMAIL;

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
      role: isOwnerAccount ? 'Owner' : profile.role,
      permissions: effectivePermissions,
      lastLogin: new Date().toISOString(),
    };

    setStaffUser(hydratedUser);
    setCloudSessionUser(hydratedUser);

    cloudListenersUnsubRef.current?.();
    cloudListenersUnsubRef.current = attachPermittedCloudListeners(
      fbUser.uid,
      isOwnerAccount,
      effectivePermissions,
      {
        onCollectionUpdate: (col, docs) => applyCloudCollectionSnapshot(col, docs),
        onSyncError: err => console.warn('Cloud sync warning:', err),
      }
    );

    setStatus('authenticated');
  };

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      const missing = getFirebaseMissingFields();
      const missingDetail =
        missing.length > 0 ? ` (${missing.join(', ')})` : '';
      setConnectionStatus({
        online: false,
        message: `Firebase Configuration Missing${missingDetail}`,
      });
      setAuthError(
        `Firebase Configuration Missing: Configure your VITE_FIREBASE_* environment variables${missingDetail}.`
      );
      setStatus('unauthenticated');
      return;
    }

    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.warn('Could not set browserLocalPersistence:', err);
    });

    getRedirectResult(auth).catch(err => {
      if (err) {
        setAuthError(mapFirebaseAuthError(err, 'google'));
      }
    });

    const unsubAuth = onAuthStateChanged(auth, async fbUser => {
      cleanupSubscriptions();
      setAuthError(null);

      if (!fbUser) {
        setFirebaseUser(null);
        setStaffUser(null);
        clearCloudSession();
        setStatus('unauthenticated');
        return;
      }

      setFirebaseUser(fbUser);

      // Load existing Firestore profile if present without blocking direct login
      let profile: User | null = null;
      if (db) {
        try {
          const snap = await getDoc(doc(db, 'users', fbUser.uid));
          if (snap.exists()) {
            profile = snap.data() as User;
          }
        } catch (err) {
          console.warn('Could not read optional staff profile doc; proceeding with Firebase Auth session:', err);
        }
      }

      const resolvedProfile = profile || buildFallbackStaffProfile(fbUser);
      activateAuthenticatedSession(fbUser, resolvedProfile);

      if (db) {
        userDocUnsubRef.current = onSnapshot(
          doc(db, 'users', fbUser.uid),
          snap => {
            if (!snap.exists()) return;
            const updated = snap.data() as User;
            const isOwnerAccount =
              updated.role === 'Owner' || (fbUser.email || '').toLowerCase() === OWNER_EMAIL;
            const hydrated: User = {
              ...updated,
              uid: fbUser.uid,
              id: fbUser.uid,
              orgId: ORG_ID,
              permissions: isOwnerAccount
                ? buildFullOwnerPermissions()
                : updated.permissions && Object.keys(updated.permissions).length > 0
                ? updated.permissions
                : getDefaultPermissionsForRole(updated.role),
            };
            setStaffUser(hydrated);
            setCloudSessionUser(hydrated);
          },
          err => {
            console.warn('Staff profile snapshot listener warning:', err.message);
          }
        );
      }
    });

    return () => {
      unsubAuth();
      cleanupSubscriptions();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!auth || !isFirebaseConfigured()) {
      const msg = mapFirebaseAuthError({ code: 'auth/configuration-missing' }, 'google');
      setAuthError(msg);
      throw new Error(msg);
    }
    setAuthError(null);
    await setPersistence(auth, browserLocalPersistence).catch(() => {});
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          const formatted = mapFirebaseAuthError(redirectErr, 'google');
          setAuthError(formatted);
          throw new Error(formatted);
        }
      }
      const formatted = mapFirebaseAuthError(err, 'google');
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth || !isFirebaseConfigured()) {
      const msg = mapFirebaseAuthError({ code: 'auth/configuration-missing' }, 'email');
      setAuthError(msg);
      throw new Error(msg);
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const msg = mapFirebaseAuthError({ code: 'auth/invalid-email' }, 'email');
      setAuthError(msg);
      throw new Error(msg);
    }
    if (!password) {
      const msg = mapFirebaseAuthError({ code: 'auth/wrong-password' }, 'email');
      setAuthError(msg);
      throw new Error(msg);
    }

    setAuthError(null);
    await setPersistence(auth, browserLocalPersistence).catch(() => {});
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: unknown) {
      const formatted = mapFirebaseAuthError(err, 'email');
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const requestPasswordReset = async (email: string) => {
    if (!auth || !isFirebaseConfigured()) {
      return {
        ok: false,
        message: mapFirebaseAuthError({ code: 'auth/configuration-missing' }, 'reset'),
      };
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        ok: false,
        message: mapFirebaseAuthError({ code: 'auth/invalid-email' }, 'reset'),
      };
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        ok: true,
        message: `Password reset email sent to ${cleanEmail}. Check your inbox.`,
      };
    } catch (err: unknown) {
      return { ok: false, message: mapFirebaseAuthError(err, 'reset') };
    }
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

  const logout = async () => {
    cleanupSubscriptions();
    setAuthError(null);
    clearCloudSession();
    setFirebaseUser(null);
    setStaffUser(null);
    if (auth) {
      await signOut(auth);
    }
    setStatus('unauthenticated');
  };

  const isOwner = Boolean(
    staffUser &&
      (staffUser.role === 'Owner' || (firebaseUser?.email || '').toLowerCase() === OWNER_EMAIL)
  );

  const can = (moduleKey: ModulePermissionKey, action: PermissionAction = 'VIEW'): boolean => {
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
        authError,
        connectionStatus,
        signInWithGoogle,
        signInWithEmail,
        requestPasswordReset,
        reauthenticateOwner,
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
