import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
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
  isOwnerEmail,
  ORG_ID,
  OWNER_EMAIL,
  requiresMandatorySuperAdmin2FA,
  SECONDARY_ADMIN_EMAIL,
  type AdminLoginAudit,
  type ModulePermissionKey,
  type PermissionAction,
  type PermissionsMatrix,
  type StaffInvite,
  type UserSession,
} from '../types/rbac';
import type { User } from '../types/erp';
import {
  applyCloudCollectionSnapshot,
  clearCloudSession,
  setCloudSessionUser,
} from '../services/storage';
import {
  attachPermittedCloudListeners,
  persistAdminLoginAudit,
  persistUserSession,
  stripUndefined,
} from '../services/firestoreSync';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'verification_required'
  | 'mfa_required'
  | 'authenticated';

export interface MfaState {
  sending: boolean;
  sent: boolean;
  verifying: boolean;
  error: string | null;
  info: string | null;
}

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: FirebaseUser | null;
  staffUser: User | null;
  isOwner: boolean;
  superAdmin2faRequired: boolean;
  superAdmin2faVerified: boolean;
  authError: string | null;
  mfaState: MfaState;
  connectionStatus: { online: boolean; message: string };
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
  resendVerificationEmail: () => Promise<{ ok: boolean; message: string }>;
  refreshVerificationStatus: () => Promise<boolean>;
  requestMfaOtp: () => Promise<void>;
  verifyMfaOtp: (code: string) => Promise<boolean>;
  verifySuperAdmin2faOtp: (code: string) => Promise<{ ok: boolean; error?: string }>;
  verifySuperAdmin2faReauth: (password?: string) => Promise<{ ok: boolean; error?: string }>;
  lockSuperAdmin2fa: () => void;
  reauthenticateOwner: () => Promise<boolean>;
  recoverFromStalledAuth: () => void;
  logout: () => Promise<void>;
  can: (moduleKey: ModulePermissionKey, action?: PermissionAction) => boolean;
  recordAdminLoginAudit: (payload: {
    eventType: AdminLoginAudit['eventType'];
    authMethod: AdminLoginAudit['authMethod'];
    status: AdminLoginAudit['status'];
    details: string;
  }) => Promise<void>;
  notifyOwnerSecurityEvent: (payload: {
    type: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    details: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

const SESSION_ID_STORAGE_KEY = 'almadina_active_session_id';
const PENDING_LOGIN_METHOD_STORAGE_KEY = 'almadina_pending_login_method';

function setPendingLoginMethodStorage(method: 'Google' | 'Email/Password' | null) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (method) {
        sessionStorage.setItem(PENDING_LOGIN_METHOD_STORAGE_KEY, method);
      } else {
        sessionStorage.removeItem(PENDING_LOGIN_METHOD_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
}

function consumePendingLoginMethodStorage(): 'Google' | 'Email/Password' | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem(PENDING_LOGIN_METHOD_STORAGE_KEY);
      sessionStorage.removeItem(PENDING_LOGIN_METHOD_STORAGE_KEY);
      if (val === 'Google' || val === 'Email/Password') {
        return val;
      }
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  return null;
}

function getOrCreateSessionId(uid: string): string {
  const fallback = `SESS-${uid.slice(0, 12)}-${Date.now().toString(36)}`;
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
      if (existing && existing.startsWith(`SESS-${uid.slice(0, 12)}`)) {
        return existing;
      }
      sessionStorage.setItem(SESSION_ID_STORAGE_KEY, fallback);
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  return fallback;
}

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
    if (code === 'auth/account-exists-with-different-credential') {
      return 'Google Sign-In Failed: An account already exists with this email using Email & Password. Sign in with Email & Password first or enable account linking in Firebase Console.';
    }
    if (code === 'auth/popup-blocked') {
      return 'Google Sign-In Popup Blocked: Allow popups for this site and try again.';
    }
    if (code === 'auth/internal-error') {
      return 'Google Sign-In Failed: Browser storage or popup was blocked. Allow cookies and popups for this site and retry.';
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

export function buildCanonicalOwnerProfile(fbUser: Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'phoneNumber' | 'emailVerified'>): User {
  const email = (fbUser.email || OWNER_EMAIL).trim().toLowerCase();
  const now = new Date().toISOString();
  const defaultOwnerName =
    email === SECONDARY_ADMIN_EMAIL ? 'Al-Madina Showroom Admin' : 'Muhammad Tariq Khan';
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    orgId: ORG_ID,
    name: fbUser.displayName || defaultOwnerName,
    email,
    role: 'Owner',
    phone: fbUser.phoneNumber || '',
    active: true,
    suspended: false,
    emailVerified: Boolean(fbUser.emailVerified),
    mfaEnabled: false,
    sessionVersion: 1,
    permissions: buildFullOwnerPermissions(),
    lastLogin: now,
    createdAt: now,
    updatedAt: now,
  };
}

export type ProfileResolutionResult =
  | { allowed: true; profile: User; needsOwnerBootstrap: boolean }
  | { allowed: false; reason: string; securityEventType: string };

/**
 * Fail-closed RBAC resolution:
 * - Requires emailVerified === true.
 * - Only canonical OWNER_EMAIL may bootstrap a new Owner doc automatically.
 * - Any non-owner without a provisioned Firestore `users/{uid}` profile is rejected.
 * - Suspended or inactive accounts are rejected.
 */
export function resolveAuthenticatedProfile(
  fbUser: Pick<FirebaseUser, 'uid' | 'email' | 'displayName' | 'phoneNumber' | 'emailVerified'>,
  existingDoc: User | null
): ProfileResolutionResult {
  if (!fbUser.emailVerified) {
    return {
      allowed: false,
      reason: 'Email verification is required before accessing Al-Madina ERP.',
      securityEventType: 'UNVERIFIED_EMAIL_LOGIN',
    };
  }

  const email = (fbUser.email || '').trim().toLowerCase();
  const isCanonicalOwner = isOwnerEmail(email);

  if (existingDoc) {
    if (!isCanonicalOwner && (!existingDoc.active || existingDoc.suspended)) {
      return {
        allowed: false,
        reason: existingDoc.suspended
          ? `Account Suspended: ${existingDoc.suspendedReason || 'Contact the Showroom Owner.'}`
          : 'Account Inactive: Ask the Showroom Owner to activate your profile.',
        securityEventType: 'SUSPENDED_OR_INACTIVE_LOGIN',
      };
    }

    const effectivePermissions: PermissionsMatrix = isCanonicalOwner || existingDoc.role === 'Owner'
      ? buildFullOwnerPermissions()
      : existingDoc.permissions && Object.keys(existingDoc.permissions).length > 0
      ? existingDoc.permissions
      : getDefaultPermissionsForRole(existingDoc.role);

    return {
      allowed: true,
      profile: {
        ...existingDoc,
        uid: fbUser.uid,
        id: fbUser.uid,
        orgId: ORG_ID,
        role: isCanonicalOwner ? 'Owner' : existingDoc.role,
        emailVerified: true,
        permissions: effectivePermissions,
      },
      needsOwnerBootstrap: isCanonicalOwner,
    };
  }

  if (isCanonicalOwner) {
    return {
      allowed: true,
      profile: buildCanonicalOwnerProfile(fbUser),
      needsOwnerBootstrap: true,
    };
  }

  return {
    allowed: false,
    reason: `Access Denied: "${fbUser.email || fbUser.uid}" is not provisioned in the Al-Madina ERP staff directory. Contact the Showroom Owner.`,
    securityEventType: 'UNPROVISIONED_USER_LOGIN',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [staffUser, setStaffUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mfaState, setMfaState] = useState<MfaState>({
    sending: false,
    sent: false,
    verifying: false,
    error: null,
    info: null,
  });
  const [connectionStatus, setConnectionStatus] = useState<{ online: boolean; message: string }>({
    online: false,
    message: 'Checking Cloud Firestore connectivity...',
  });

  const cloudListenersUnsubRef = useRef<(() => void) | null>(null);
  const userDocUnsubRef = useRef<(() => void) | null>(null);
  const sessionDocUnsubRef = useRef<(() => void) | null>(null);
  const pendingMfaRef = useRef<{ fbUser: FirebaseUser; profile: User } | null>(null);
  const activeSessionVersionRef = useRef<number>(1);
  const mfaVerifiedForUidRef = useRef<string | null>(null);
  const pendingLoginMethodRef = useRef<'Google' | 'Email/Password' | null>(null);
  const auditedSessionUidRef = useRef<string | null>(null);
  const [superAdmin2faVerified, setSuperAdmin2faVerified] = useState(false);

  const cleanupSubscriptions = () => {
    cloudListenersUnsubRef.current?.();
    cloudListenersUnsubRef.current = null;
    userDocUnsubRef.current?.();
    userDocUnsubRef.current = null;
    sessionDocUnsubRef.current?.();
    sessionDocUnsubRef.current = null;
  };

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

  const recordAdminLoginAudit = async (
    payload: {
      eventType: AdminLoginAudit['eventType'];
      authMethod: AdminLoginAudit['authMethod'];
      status: AdminLoginAudit['status'];
      details: string;
    },
    actorOverride?: { uid: string; email: string; name: string; role: string }
  ) => {
    const actorUid = actorOverride?.uid || firebaseUser?.uid || staffUser?.uid;
    const actorEmail = (actorOverride?.email || firebaseUser?.email || staffUser?.email || '').trim().toLowerCase();
    const actorName = actorOverride?.name || staffUser?.name || firebaseUser?.displayName || actorEmail || 'Admin';
    const actorRole = actorOverride?.role || staffUser?.role || 'Owner';
    if (!actorUid || (!isOwnerEmail(actorEmail) && actorRole !== 'Owner')) return;

    let serverPersisted = false;
    let serverRecord: AdminLoginAudit | null = null;
    try {
      const res = await authorizedApiFetch('/api/admin/login-audit', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          userName: actorName,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : 'Browser',
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        serverPersisted = Boolean(data.persistedByServer);
        if (data.auditRecord) {
          serverRecord = data.auditRecord as AdminLoginAudit;
        }
      }
    } catch {
      // Fall back to direct Firestore client persistence
    }

    if (!serverPersisted) {
      const fallbackId = `ADMAUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const fallbackRecord: AdminLoginAudit = serverRecord || {
        id: fallbackId,
        orgId: ORG_ID,
        uid: actorUid,
        email: actorEmail,
        userName: actorName,
        role: actorRole,
        eventType: payload.eventType,
        authMethod: payload.authMethod,
        ipAddress: 'Static Host (Client Direct)',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : 'Browser',
        status: payload.status,
        details: payload.details,
        timestamp: new Date().toISOString(),
      };
      await persistAdminLoginAudit(fallbackRecord).catch(() => {});
    }
  };

  const ensureOwnerBootstrapDocs = async (fbUser: FirebaseUser, ownerProfile: User) => {
    if (!db) return;
    const now = new Date().toISOString();
    const safeSessionVersion =
      Number.isFinite(Number(ownerProfile.sessionVersion)) && Number(ownerProfile.sessionVersion) >= 1
        ? Math.floor(Number(ownerProfile.sessionVersion))
        : 1;
    const canonicalEmail = (fbUser.email || ownerProfile.email || OWNER_EMAIL).trim().toLowerCase();
    const cleanOwnerUser = stripUndefined({
      id: fbUser.uid,
      uid: fbUser.uid,
      orgId: ORG_ID,
      name: ownerProfile.name || fbUser.displayName || 'Showroom Owner Admin',
      email: canonicalEmail,
      role: 'Owner' as const,
      customRoleName: ownerProfile.customRoleName,
      phone: ownerProfile.phone || '',
      avatar: ownerProfile.avatar,
      active: true,
      suspended: false,
      suspendedReason: ownerProfile.suspendedReason,
      emailVerified: true,
      mfaEnabled: Boolean(ownerProfile.mfaEnabled),
      sessionVersion: safeSessionVersion,
      permissions: buildFullOwnerPermissions(),
      lastLogin: now,
      createdAt: ownerProfile.createdAt || now,
      updatedAt: now,
    });
    try {
      await withTimeout(
        Promise.allSettled([
          setDoc(
            doc(db, 'admins', fbUser.uid),
            {
              uid: fbUser.uid,
              email: canonicalEmail,
              role: 'Owner',
              createdAt: ownerProfile.createdAt || now,
            },
            { merge: true }
          ),
          setDoc(
            doc(db, 'users', fbUser.uid),
            cleanOwnerUser,
            { merge: true }
          ),
          setDoc(
            doc(db, 'users_public', fbUser.uid),
            {
              uid: fbUser.uid,
              orgId: ORG_ID,
              name: cleanOwnerUser.name,
              role: 'Owner',
              active: true,
            },
            { merge: true }
          ),
        ]),
        8000,
        'Owner bootstrap sync timed out.'
      );
    } catch (err) {
      console.warn('Owner Firestore bootstrap warning:', err);
    }
  };

  const forceRevokedSignOut = async (message: string) => {
    cleanupSubscriptions();
    pendingMfaRef.current = null;
    mfaVerifiedForUidRef.current = null;
    pendingLoginMethodRef.current = null;
    setPendingLoginMethodStorage(null);
    auditedSessionUidRef.current = null;
    setSuperAdmin2faVerified(false);
    clearCloudSession();
    setFirebaseUser(null);
    setStaffUser(null);
    setAuthError(message);
    if (auth) {
      await withTimeout(signOut(auth), 4000, 'Sign out timed out.').catch(() => {});
    }
    setStatus('unauthenticated');
  };

  const activateAuthenticatedSession = (fbUser: FirebaseUser, profile: User) => {
    const isOwnerAccount =
      profile.role === 'Owner' || isOwnerEmail(fbUser.email);

    const effectivePermissions: PermissionsMatrix = isOwnerAccount
      ? buildFullOwnerPermissions()
      : profile.permissions && Object.keys(profile.permissions).length > 0
      ? profile.permissions
      : getDefaultPermissionsForRole(profile.role);

    const now = new Date().toISOString();
    const hydratedUser: User = {
      ...profile,
      uid: fbUser.uid,
      id: fbUser.uid,
      orgId: ORG_ID,
      role: isOwnerAccount ? 'Owner' : profile.role,
      permissions: effectivePermissions,
      lastLogin: now,
    };

    activeSessionVersionRef.current = Number(hydratedUser.sessionVersion || 1);
    setStaffUser(hydratedUser);
    setCloudSessionUser(hydratedUser);

    if (db) {
      const sessionId = getOrCreateSessionId(fbUser.uid);
      const sessionDoc: UserSession = {
        id: sessionId,
        orgId: ORG_ID,
        uid: fbUser.uid,
        email: hydratedUser.email,
        userName: hydratedUser.name,
        role: hydratedUser.role,
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : 'Browser',
        revoked: false,
        createdAt: now,
        lastActiveAt: now,
      };
      persistUserSession(sessionDoc).catch(() => {});

      sessionDocUnsubRef.current?.();
      sessionDocUnsubRef.current = onSnapshot(
        doc(db, 'sessions', sessionId),
        snap => {
          if (snap.exists() && snap.data()?.revoked === true) {
            forceRevokedSignOut('Session Revoked: Your session was terminated by the Showroom Owner.');
          }
        },
        err => console.warn('Session listener warning:', err.message)
      );

      userDocUnsubRef.current?.();
      userDocUnsubRef.current = onSnapshot(
        doc(db, 'users', fbUser.uid),
        snap => {
          if (!snap.exists()) return;
          const updated = snap.data() as User;
          const updatedIsOwner =
            updated.role === 'Owner' || isOwnerEmail(fbUser.email);

          if (!updatedIsOwner && (!updated.active || updated.suspended)) {
            forceRevokedSignOut(
              updated.suspended
                ? `Account Suspended: ${updated.suspendedReason || 'Contact the Showroom Owner.'}`
                : 'Account Deactivated: Contact the Showroom Owner.'
            );
            return;
          }

          const newVersion = Number(updated.sessionVersion || 1);
          if (newVersion > activeSessionVersionRef.current) {
            forceRevokedSignOut('Session Revoked: Permissions or sessions were reset by the Showroom Owner. Please sign in again.');
            return;
          }

          const updatedHydrated: User = {
            ...updated,
            uid: fbUser.uid,
            id: fbUser.uid,
            orgId: ORG_ID,
            permissions: updatedIsOwner
              ? buildFullOwnerPermissions()
              : updated.permissions && Object.keys(updated.permissions).length > 0
              ? updated.permissions
              : getDefaultPermissionsForRole(updated.role),
          };
          setStaffUser(updatedHydrated);
          setCloudSessionUser(updatedHydrated);
        },
        err => {
          console.warn('Staff profile snapshot listener warning:', err.message);
        }
      );
    }

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

    if (isOwnerAccount) {
      const interactiveMethod = pendingLoginMethodRef.current || consumePendingLoginMethodStorage();
      pendingLoginMethodRef.current = null;
      if (interactiveMethod || auditedSessionUidRef.current !== fbUser.uid) {
        auditedSessionUidRef.current = fbUser.uid;
        void recordAdminLoginAudit(
          interactiveMethod
            ? {
                eventType: 'ADMIN_LOGIN_SUCCESS',
                authMethod: interactiveMethod,
                status: 'Success',
                details: `Admin ${hydratedUser.email} signed in via ${interactiveMethod}.`,
              }
            : {
                eventType: 'ADMIN_SESSION_RESUME',
                authMethod: 'Session Restore',
                status: 'Success',
                details: `Admin ${hydratedUser.email} resumed an active authenticated session.`,
              },
          {
            uid: fbUser.uid,
            email: hydratedUser.email,
            name: hydratedUser.name,
            role: hydratedUser.role,
          }
        );
      }
    }

    setStatus('authenticated');
  };

  const triggerMfaChallenge = async () => {
    setMfaState({ sending: true, sent: false, verifying: false, error: null, info: null });
    try {
      const res = await authorizedApiFetch('/api/mfa/request', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMfaState({
          sending: false,
          sent: false,
          verifying: false,
          error: data.error || `Could not send verification code (HTTP ${res.status}).`,
          info: null,
        });
        return;
      }
      setMfaState({
        sending: false,
        sent: true,
        verifying: false,
        error: null,
        info: 'A 6-digit verification code has been sent to your registered email (valid 5 minutes).',
      });
    } catch (err: any) {
      setMfaState({
        sending: false,
        sent: false,
        verifying: false,
        error: err?.message || 'Unable to contact MFA verification server.',
        info: null,
      });
    }
  };

  const evaluateFirebaseUser = async (fbUser: FirebaseUser) => {
    if (!fbUser.emailVerified) {
      setFirebaseUser(fbUser);
      setStatus('verification_required');
      return;
    }

    const normalizedEmail = (fbUser.email || '').trim().toLowerCase();
    const isCanonicalOwner = isOwnerEmail(normalizedEmail);
    let existingProfile: User | null = null;
    if (db) {
      try {
        const snap = await withTimeout(
          getDoc(doc(db, 'users', fbUser.uid)),
          6000,
          'Cloud Firestore profile lookup timed out.'
        );
        if (snap.exists()) {
          existingProfile = snap.data() as User;
        } else if (!isCanonicalOwner && normalizedEmail) {
          // Check Owner-issued staff invite so Google Sign-In works even on static GitHub Pages without server.ts
          const inviteSnap = await withTimeout(
            getDoc(doc(db, 'staffInvites', normalizedEmail)),
            6000,
            'Cloud Firestore staff invite lookup timed out.'
          );
          if (inviteSnap.exists()) {
            const invite = inviteSnap.data() as StaffInvite;
            if (invite.active !== false && invite.orgId === ORG_ID) {
              const now = new Date().toISOString();
              const newStaffDoc: User = stripUndefined({
                id: fbUser.uid,
                uid: fbUser.uid,
                orgId: ORG_ID,
                name: invite.name || fbUser.displayName || normalizedEmail.split('@')[0],
                email: normalizedEmail,
                role: invite.role,
                customRoleName: invite.customRoleName,
                phone: invite.phone || fbUser.phoneNumber || '',
                active: true,
                suspended: false,
                emailVerified: true,
                mfaEnabled: Boolean(invite.mfaEnabled),
                sessionVersion: 1,
                permissions:
                  invite.permissions && Object.keys(invite.permissions).length > 0
                    ? invite.permissions
                    : getDefaultPermissionsForRole(invite.role),
                lastLogin: now,
                createdAt: invite.createdAt || now,
                updatedAt: now,
              });
              await withTimeout(
                setDoc(doc(db, 'users', fbUser.uid), newStaffDoc),
                6000,
                'Staff profile activation timed out.'
              );
              await deleteDoc(doc(db, 'staffInvites', normalizedEmail)).catch(() => {});
              existingProfile = newStaffDoc;
            }
          }
        }
      } catch (err: any) {
        if (!isCanonicalOwner) {
          await forceRevokedSignOut(
            `Access Verification Failed: Could not verify your staff permissions in Cloud Firestore (${err?.message || 'permission denied'}).`
          );
          return;
        }
        console.warn('Canonical owner profile lookup fallback active:', err?.message || err);
      }
    }

    const resolution = resolveAuthenticatedProfile(fbUser, existingProfile);
    if (!resolution.allowed) {
      void notifyOwnerSecurityEvent({
        type: resolution.securityEventType,
        severity: 'WARNING',
        title: `Blocked Sign-In: ${fbUser.email || fbUser.uid}`,
        details: resolution.reason,
      });
      await forceRevokedSignOut(resolution.reason);
      return;
    }

    if (resolution.needsOwnerBootstrap) {
      // Run owner doc bootstrap non-blockingly so slow/offline Firestore never locks the loading screen.
      void ensureOwnerBootstrapDocs(fbUser, resolution.profile);
    }

    if (resolution.profile.mfaEnabled && mfaVerifiedForUidRef.current !== fbUser.uid) {
      pendingMfaRef.current = { fbUser, profile: resolution.profile };
      setFirebaseUser(fbUser);
      setStatus('mfa_required');
      await triggerMfaChallenge();
      return;
    }

    activateAuthenticatedSession(fbUser, resolution.profile);
  };

  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      const missing = getFirebaseMissingFields();
      const missingDetail = missing.length > 0 ? ` (${missing.join(', ')})` : '';
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

    let isMounted = true;
    let authSettled = false;

    const startupWatchdog = setTimeout(() => {
      if (!isMounted || authSettled) return;
      authSettled = true;
      setConnectionStatus({
        online: false,
        message: 'Authentication startup timed out. Ready for manual sign-in.',
      });
      setAuthError(
        'Sign-in initialization took longer than expected (network or browser storage blocked). Please sign in below or reload.'
      );
      setStatus('unauthenticated');
    }, 8000);

    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.warn('Could not set browserLocalPersistence:', err);
    });

    getRedirectResult(auth).catch(err => {
      if (err && isMounted) {
        setAuthError(mapFirebaseAuthError(err, 'google'));
      }
    });

    const unsubAuth = onAuthStateChanged(
      auth,
      async fbUser => {
        authSettled = true;
        clearTimeout(startupWatchdog);
        if (!isMounted) return;

        try {
          cleanupSubscriptions();
          pendingMfaRef.current = null;
          setAuthError(null);

          if (!fbUser) {
            mfaVerifiedForUidRef.current = null;
            auditedSessionUidRef.current = null;
            setSuperAdmin2faVerified(false);
            setFirebaseUser(null);
            setStaffUser(null);
            clearCloudSession();
            setConnectionStatus({
              online: false,
              message: 'Firebase SDK ready (sign in to connect to Cloud Firestore).',
            });
            setStatus('unauthenticated');
            return;
          }

          if (auditedSessionUidRef.current && auditedSessionUidRef.current !== fbUser.uid) {
            setSuperAdmin2faVerified(false);
            auditedSessionUidRef.current = null;
          }

          setFirebaseUser(fbUser);
          testConnection()
            .then(res => {
              if (isMounted) setConnectionStatus(res);
            })
            .catch(() => {});
          await evaluateFirebaseUser(fbUser);
        } catch (err: any) {
          console.error('Auth state evaluation error:', err);
          if (!isMounted) return;
          cleanupSubscriptions();
          setStaffUser(null);
          clearCloudSession();
          setAuthError(err?.message || 'Unable to verify authentication session. Please sign in again.');
          setStatus('unauthenticated');
        }
      },
      err => {
        authSettled = true;
        clearTimeout(startupWatchdog);
        if (!isMounted) return;
        console.error('Firebase onAuthStateChanged error:', err);
        setAuthError(mapFirebaseAuthError(err, 'email'));
        setStatus('unauthenticated');
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(startupWatchdog);
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
    pendingLoginMethodRef.current = 'Google';
    setPendingLoginMethodStorage('Google');
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
          pendingLoginMethodRef.current = null;
          setPendingLoginMethodStorage(null);
          const formatted = mapFirebaseAuthError(redirectErr, 'google');
          setAuthError(formatted);
          throw new Error(formatted);
        }
      }
      pendingLoginMethodRef.current = null;
      setPendingLoginMethodStorage(null);
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
    pendingLoginMethodRef.current = 'Email/Password';
    setPendingLoginMethodStorage('Email/Password');
    await setPersistence(auth, browserLocalPersistence).catch(() => {});
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: unknown) {
      pendingLoginMethodRef.current = null;
      setPendingLoginMethodStorage(null);
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

  const resendVerificationEmail = async () => {
    const user = auth?.currentUser;
    if (!user) {
      return { ok: false, message: 'No active user session found.' };
    }
    try {
      await sendEmailVerification(user);
      return { ok: true, message: `Verification email sent to ${user.email}. Check your inbox and spam folder.` };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Failed to send verification email.' };
    }
  };

  const refreshVerificationStatus = async () => {
    const user = auth?.currentUser;
    if (!user) return false;
    await user.reload();
    if (!user.emailVerified) {
      return false;
    }
    await evaluateFirebaseUser(user);
    return true;
  };

  const requestMfaOtp = async () => {
    await triggerMfaChallenge();
  };

  const verifyMfaOtp = async (code: string) => {
    const pending = pendingMfaRef.current;
    if (!pending) return false;
    setMfaState(prev => ({ ...prev, verifying: true, error: null }));
    try {
      const res = await authorizedApiFetch('/api/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.verified) {
        setMfaState(prev => ({
          ...prev,
          verifying: false,
          error: data.error || 'Invalid or expired OTP code.',
        }));
        return false;
      }
      mfaVerifiedForUidRef.current = pending.fbUser.uid;
      pendingMfaRef.current = null;
      setMfaState({ sending: false, sent: false, verifying: false, error: null, info: null });
      activateAuthenticatedSession(pending.fbUser, pending.profile);
      return true;
    } catch (err: any) {
      setMfaState(prev => ({
        ...prev,
        verifying: false,
        error: err?.message || 'OTP verification request failed.',
      }));
      return false;
    }
  };

  const verifySuperAdmin2faOtp = async (code: string): Promise<{ ok: boolean; error?: string }> => {
    const cleanCode = code.trim();
    if (!cleanCode) {
      return { ok: false, error: 'Enter the 6-digit verification code.' };
    }
    setMfaState(prev => ({ ...prev, verifying: true, error: null }));
    try {
      const res = await authorizedApiFetch('/api/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: cleanCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.verified) {
        const errMsg = data.error || 'Invalid or expired OTP code.';
        setMfaState(prev => ({ ...prev, verifying: false, error: errMsg }));
        if (!data.auditPersisted) {
          await recordAdminLoginAudit({
            eventType: 'ADMIN_2FA_FAILED',
            authMethod: '2FA Email OTP',
            status: 'Failed',
            details: `SuperAdminView 2FA OTP failed: ${errMsg}`,
          });
        }
        return { ok: false, error: errMsg };
      }
      setMfaState({ sending: false, sent: false, verifying: false, error: null, info: null });
      setSuperAdmin2faVerified(true);
      if (!data.auditPersisted) {
        await recordAdminLoginAudit({
          eventType: 'ADMIN_2FA_PASSED',
          authMethod: '2FA Email OTP',
          status: 'Verified',
          details: 'Verified 6-digit email OTP to unlock SuperAdminView.',
        });
      }
      return { ok: true };
    } catch (err: any) {
      const errMsg = err?.message || 'OTP verification request failed.';
      setMfaState(prev => ({ ...prev, verifying: false, error: errMsg }));
      return { ok: false, error: errMsg };
    }
  };

  const verifySuperAdmin2faReauth = async (password?: string): Promise<{ ok: boolean; error?: string }> => {
    if (!auth?.currentUser) {
      return { ok: false, error: 'No active Firebase session found.' };
    }
    setMfaState(prev => ({ ...prev, verifying: true, error: null }));
    try {
      if (password !== undefined) {
        const email = auth.currentUser.email || '';
        if (!email || !password) {
          setMfaState(prev => ({ ...prev, verifying: false, error: 'Account password is required.' }));
          return { ok: false, error: 'Account password is required.' };
        }
        const credential = EmailAuthProvider.credential(email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account',
          login_hint: auth.currentUser.email || '',
        });
        await reauthenticateWithPopup(auth.currentUser, provider);
      }
      setMfaState({ sending: false, sent: false, verifying: false, error: null, info: null });
      setSuperAdmin2faVerified(true);
      await recordAdminLoginAudit({
        eventType: 'ADMIN_2FA_PASSED',
        authMethod: '2FA Re-Auth',
        status: 'Verified',
        details:
          password !== undefined
            ? 'Completed mandatory SuperAdminView 2FA via live password re-authentication.'
            : 'Completed mandatory SuperAdminView 2FA via live Google re-authentication.',
      });
      return { ok: true };
    } catch (err: unknown) {
      const mapped = mapFirebaseAuthError(err, password !== undefined ? 'email' : 'google');
      setMfaState(prev => ({ ...prev, verifying: false, error: mapped }));
      await recordAdminLoginAudit({
        eventType: 'ADMIN_2FA_FAILED',
        authMethod: '2FA Re-Auth',
        status: 'Failed',
        details: `Mandatory SuperAdminView 2FA re-authentication failed: ${mapped}`,
      });
      return { ok: false, error: mapped };
    }
  };

  const lockSuperAdmin2fa = () => {
    setSuperAdmin2faVerified(false);
    setMfaState({ sending: false, sent: false, verifying: false, error: null, info: null });
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

  const recoverFromStalledAuth = () => {
    cleanupSubscriptions();
    pendingMfaRef.current = null;
    setAuthError(null);
    setStatus('unauthenticated');
  };

  const logout = async () => {
    cleanupSubscriptions();
    pendingMfaRef.current = null;
    mfaVerifiedForUidRef.current = null;
    pendingLoginMethodRef.current = null;
    setPendingLoginMethodStorage(null);
    auditedSessionUidRef.current = null;
    setSuperAdmin2faVerified(false);
    setAuthError(null);
    setMfaState({ sending: false, sent: false, verifying: false, error: null, info: null });
    clearCloudSession();
    setFirebaseUser(null);
    setStaffUser(null);
    if (auth) {
      await withTimeout(signOut(auth), 4000, 'Sign out timed out.').catch(() => {});
    }
    setStatus('unauthenticated');
  };

  const isOwner = Boolean(
    staffUser &&
      (staffUser.role === 'Owner' || isOwnerEmail(firebaseUser?.email))
  );
  const superAdmin2faRequired = Boolean(
    isOwner && requiresMandatorySuperAdmin2FA(staffUser?.email || firebaseUser?.email)
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
        superAdmin2faRequired,
        superAdmin2faVerified,
        authError,
        mfaState,
        connectionStatus,
        signInWithGoogle,
        signInWithEmail,
        requestPasswordReset,
        resendVerificationEmail,
        refreshVerificationStatus,
        requestMfaOtp,
        verifyMfaOtp,
        verifySuperAdmin2faOtp,
        verifySuperAdmin2faReauth,
        lockSuperAdmin2fa,
        reauthenticateOwner,
        recoverFromStalledAuth,
        logout,
        can,
        recordAdminLoginAudit,
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
