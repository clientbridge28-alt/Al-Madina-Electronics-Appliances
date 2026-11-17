import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
}

function cleanEnvValue(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^"+|"+$/g, '').replace(/,+$/, '').replace(/^"+|"+$/g, '').trim();
}

export function getFirebaseConfig(): FirebaseConfig {
  // Prefer the provisioned firebase-applet-config.json as the authoritative configuration
  // so stale or quoted VITE_FIREBASE_* environment variables cannot override the database/project.
  const projectId = firebaseConfigJson.projectId || cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  const apiKey = firebaseConfigJson.apiKey || cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY);
  const authDomain = firebaseConfigJson.authDomain || cleanEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
  const storageBucket = firebaseConfigJson.storageBucket || cleanEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = firebaseConfigJson.messagingSenderId || cleanEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  const appId = firebaseConfigJson.appId || cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID);

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    firestoreDatabaseId: firebaseConfigJson.firestoreDatabaseId,
    oAuthClientId: firebaseConfigJson.oAuthClientId,
  };
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(
    cfg.apiKey &&
    cfg.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    cfg.projectId &&
    cfg.projectId !== 'YOUR_FIREBASE_PROJECT_ID' &&
    cfg.projectId !== 'remixed-project-id'
  );
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    const cfg = getFirebaseConfig();
    const apps = getApps();
    app = apps.length > 0 ? apps[0] : initializeApp(cfg);
    // CRITICAL: Connect to the provisioned Enterprise database ID from firebase-applet-config.json
    try {
      db = cfg.firestoreDatabaseId
        ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, cfg.firestoreDatabaseId)
        : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch {
      db = cfg.firestoreDatabaseId
        ? getFirestore(app, cfg.firestoreDatabaseId)
        : getFirestore(app);
    }
    auth = getAuth(app);
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
}

export { app, db, auth };

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null
): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions');
}

export async function testConnection(): Promise<{ online: boolean; message: string }> {
  if (!db) {
    return { online: false, message: 'Firestore SDK not initialized.' };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { online: true, message: 'Connected to Cloud Firestore server.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
      return { online: false, message: 'Firestore client is offline. Check Firebase configuration.' };
    }
    // permission-denied on /test/connection when unauthenticated confirms server reachability
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      return { online: true, message: 'Firestore server reachable (authentication required).' };
    }
    return { online: false, message: msg };
  }
}

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
}

export async function authorizedApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
}

export function getCloudPersistenceStatus(): {
  isConfigured: boolean;
  provider: 'Firestore' | 'LocalStorage Engine';
  details: string;
} {
  if (isFirebaseConfigured() && db) {
    return {
      isConfigured: true,
      provider: 'Firestore',
      details: `Connected to Cloud Firestore (${getFirebaseConfig().projectId})`,
    };
  }
  return {
    isConfigured: false,
    provider: 'LocalStorage Engine',
    details: 'Offline local database fallback.',
  };
}
