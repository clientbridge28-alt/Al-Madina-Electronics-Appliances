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

export interface FirebaseRuntimeDiagnostics {
  projectId: string;
  authDomain: string;
  firestoreDatabaseId: string;
  configuredVia: 'env' | 'firebase-applet-config' | 'unconfigured';
  origin: string;
  authInitialized: boolean;
  firestoreInitialized: boolean;
  apiKeyPresent: boolean;
}

function cleanEnvValue(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^"+|"+$/g, '').replace(/,+$/, '').replace(/^"+|"+$/g, '').trim();
}

function isRawMalformedEnv(val?: string): boolean {
  if (!val) return false;
  const t = val.trim();
  return t.startsWith('"') || t.endsWith(',');
}

function isPlaceholderConfig(projectId?: string, apiKey?: string): boolean {
  return (
    !projectId ||
    !apiKey ||
    projectId === 'YOUR_FIREBASE_PROJECT_ID' ||
    projectId === 'remixed-project-id' ||
    apiKey === 'YOUR_FIREBASE_API_KEY'
  );
}

export function resolveFirebaseConfig(
  env: Record<string, unknown> = ((import.meta as unknown as { env?: Record<string, unknown> }).env || {})
): FirebaseConfig {
  const envProject = typeof env.VITE_FIREBASE_PROJECT_ID === 'string' ? env.VITE_FIREBASE_PROJECT_ID : undefined;
  const envApiKey = typeof env.VITE_FIREBASE_API_KEY === 'string' ? env.VITE_FIREBASE_API_KEY : undefined;
  const envAuthDomain = typeof env.VITE_FIREBASE_AUTH_DOMAIN === 'string' ? env.VITE_FIREBASE_AUTH_DOMAIN : undefined;
  const envStorageBucket = typeof env.VITE_FIREBASE_STORAGE_BUCKET === 'string' ? env.VITE_FIREBASE_STORAGE_BUCKET : undefined;
  const envMessagingSenderId =
    typeof env.VITE_FIREBASE_MESSAGING_SENDER_ID === 'string' ? env.VITE_FIREBASE_MESSAGING_SENDER_ID : undefined;
  const envAppId = typeof env.VITE_FIREBASE_APP_ID === 'string' ? env.VITE_FIREBASE_APP_ID : undefined;
  const envDbId = typeof env.VITE_FIREBASE_DATABASE_ID === 'string' ? env.VITE_FIREBASE_DATABASE_ID : undefined;

  const cleanEnvProject = cleanEnvValue(envProject);
  const cleanEnvApiKey = cleanEnvValue(envApiKey);
  const cleanEnvAuthDomain = cleanEnvValue(envAuthDomain);
  const cleanEnvStorageBucket = cleanEnvValue(envStorageBucket);
  const cleanEnvMessagingSenderId = cleanEnvValue(envMessagingSenderId);
  const cleanEnvAppId = cleanEnvValue(envAppId);
  const cleanEnvDbId = cleanEnvValue(envDbId);

  const envLooksClean =
    Boolean(cleanEnvProject) &&
    !isRawMalformedEnv(envProject) &&
    !isRawMalformedEnv(envApiKey) &&
    !isPlaceholderConfig(cleanEnvProject, cleanEnvApiKey || firebaseConfigJson.apiKey);

  const sameAsBundledProject = cleanEnvProject === firebaseConfigJson.projectId;
  const allowEnvOverride =
    envLooksClean && (sameAsBundledProject || !firebaseConfigJson.projectId || Boolean(cleanEnvApiKey));

  if (allowEnvOverride && !sameAsBundledProject) {
    return {
      apiKey: cleanEnvApiKey,
      authDomain: cleanEnvAuthDomain || `${cleanEnvProject}.firebaseapp.com`,
      projectId: cleanEnvProject,
      storageBucket: cleanEnvStorageBucket || `${cleanEnvProject}.firebasestorage.app`,
      messagingSenderId: cleanEnvMessagingSenderId,
      appId: cleanEnvAppId,
      firestoreDatabaseId: cleanEnvDbId || undefined,
      oAuthClientId: undefined,
    };
  }

  return {
    apiKey: (allowEnvOverride ? cleanEnvApiKey : '') || firebaseConfigJson.apiKey || cleanEnvApiKey,
    authDomain: (allowEnvOverride ? cleanEnvAuthDomain : '') || firebaseConfigJson.authDomain || cleanEnvAuthDomain,
    projectId: (allowEnvOverride ? cleanEnvProject : '') || firebaseConfigJson.projectId || cleanEnvProject,
    storageBucket:
      (allowEnvOverride ? cleanEnvStorageBucket : '') || firebaseConfigJson.storageBucket || cleanEnvStorageBucket,
    messagingSenderId:
      (allowEnvOverride ? cleanEnvMessagingSenderId : '') ||
      firebaseConfigJson.messagingSenderId ||
      cleanEnvMessagingSenderId,
    appId: (allowEnvOverride ? cleanEnvAppId : '') || firebaseConfigJson.appId || cleanEnvAppId,
    firestoreDatabaseId: (allowEnvOverride ? cleanEnvDbId : '') || firebaseConfigJson.firestoreDatabaseId || undefined,
    oAuthClientId: firebaseConfigJson.oAuthClientId,
  };
}

export function getFirebaseConfig(): FirebaseConfig {
  return resolveFirebaseConfig();
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return !isPlaceholderConfig(cfg.projectId, cfg.apiKey);
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    const cfg = getFirebaseConfig();
    const apps = getApps();
    app = apps.length > 0 ? apps[0] : initializeApp(cfg);
    try {
      db = cfg.firestoreDatabaseId
        ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, cfg.firestoreDatabaseId)
        : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch {
      db = cfg.firestoreDatabaseId ? getFirestore(app, cfg.firestoreDatabaseId) : getFirestore(app);
    }
    auth = getAuth(app);
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
}

export function getFirebaseRuntimeDiagnostics(): FirebaseRuntimeDiagnostics {
  const cfg = getFirebaseConfig();
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env || {};
  const envProject = typeof env.VITE_FIREBASE_PROJECT_ID === 'string' ? cleanEnvValue(env.VITE_FIREBASE_PROJECT_ID) : '';
  const usingEnv =
    Boolean(envProject) &&
    cfg.projectId === envProject &&
    !isRawMalformedEnv(typeof env.VITE_FIREBASE_PROJECT_ID === 'string' ? env.VITE_FIREBASE_PROJECT_ID : undefined) &&
    (cfg.projectId !== firebaseConfigJson.projectId ||
      cleanEnvValue(typeof env.VITE_FIREBASE_API_KEY === 'string' ? env.VITE_FIREBASE_API_KEY : undefined) === cfg.apiKey);

  return {
    projectId: cfg.projectId || '(none)',
    authDomain: cfg.authDomain || '(none)',
    firestoreDatabaseId: cfg.firestoreDatabaseId || '(default)',
    configuredVia: !isFirebaseConfigured()
      ? 'unconfigured'
      : usingEnv
      ? 'env'
      : 'firebase-applet-config',
    origin: typeof window !== 'undefined' ? window.location.origin : 'server',
    authInitialized: Boolean(auth),
    firestoreInitialized: Boolean(db),
    apiKeyPresent: Boolean(cfg.apiKey),
  };
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
  const env = (import.meta as any).env || {};
  return String(env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
}

export async function authorizedApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl && typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Backend API unavailable on static GitHub Pages host. Deploy server.ts to Cloud Run/Node and configure VITE_API_BASE_URL.',
        message: 'Backend API requires a Node/Cloud Run server (not supported directly on static GitHub Pages).',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const ct = res.headers.get('content-type') || '';
  if (path.startsWith('/api/') && ct.includes('text/html')) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'API endpoint returned HTML instead of JSON. Configure VITE_API_BASE_URL to point to your backend server.',
        message: 'Backend server route unavailable on this static host.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return res;
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
