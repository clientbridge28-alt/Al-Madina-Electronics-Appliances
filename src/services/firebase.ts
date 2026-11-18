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
  storageBucket: string;
  firestoreDatabaseId: string;
  configuredVia: 'env' | 'firebase-applet-config' | 'merged' | 'unconfigured';
  isConfigured: boolean;
  missingFields: string[];
  origin: string;
  apiBaseUrl: string;
  authInitialized: boolean;
  firestoreInitialized: boolean;
  apiKeyPresent: boolean;
  appIdPresent: boolean;
  initError: string | null;
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

function isPlaceholderValue(val?: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return (
    !trimmed ||
    trimmed === 'YOUR_FIREBASE_PROJECT_ID' ||
    trimmed === 'YOUR_FIREBASE_API_KEY' ||
    trimmed === 'YOUR_FIREBASE_APP_ID' ||
    trimmed === 'YOUR_FIREBASE_AUTH_DOMAIN' ||
    trimmed === 'remixed-project-id'
  );
}

function isPlaceholderConfig(projectId?: string, apiKey?: string): boolean {
  return isPlaceholderValue(projectId) || isPlaceholderValue(apiKey);
}

function sanitizeCleanEnvField(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  if (isRawMalformedEnv(raw)) return '';
  const cleaned = cleanEnvValue(raw);
  return isPlaceholderValue(cleaned) ? '' : cleaned;
}

export function resolveFirebaseConfig(
  env: Record<string, unknown> = ((import.meta as unknown as { env?: Record<string, unknown> }).env || {}),
  bundledConfig: Partial<FirebaseConfig> = firebaseConfigJson
): FirebaseConfig {
  const cleanEnvProject = sanitizeCleanEnvField(env.VITE_FIREBASE_PROJECT_ID);
  const cleanEnvApiKey = sanitizeCleanEnvField(env.VITE_FIREBASE_API_KEY);
  const cleanEnvAuthDomain = sanitizeCleanEnvField(env.VITE_FIREBASE_AUTH_DOMAIN);
  const cleanEnvStorageBucket = sanitizeCleanEnvField(env.VITE_FIREBASE_STORAGE_BUCKET);
  const cleanEnvMessagingSenderId = sanitizeCleanEnvField(env.VITE_FIREBASE_MESSAGING_SENDER_ID);
  const cleanEnvAppId = sanitizeCleanEnvField(env.VITE_FIREBASE_APP_ID);
  const cleanEnvDbId = sanitizeCleanEnvField(env.VITE_FIREBASE_DATABASE_ID);

  const bundledProject = isPlaceholderValue(bundledConfig.projectId) ? '' : String(bundledConfig.projectId || '').trim();
  const bundledApiKey = isPlaceholderValue(bundledConfig.apiKey) ? '' : String(bundledConfig.apiKey || '').trim();
  const bundledAuthDomain = isPlaceholderValue(bundledConfig.authDomain) ? '' : String(bundledConfig.authDomain || '').trim();
  const bundledStorageBucket = isPlaceholderValue(bundledConfig.storageBucket)
    ? ''
    : String(bundledConfig.storageBucket || '').trim();
  const bundledSenderId = isPlaceholderValue(bundledConfig.messagingSenderId)
    ? ''
    : String(bundledConfig.messagingSenderId || '').trim();
  const bundledAppId = isPlaceholderValue(bundledConfig.appId) ? '' : String(bundledConfig.appId || '').trim();
  const bundledDbId = String(bundledConfig.firestoreDatabaseId || '').trim();

  // If VITE_FIREBASE_PROJECT_ID cleanly points to a different Firebase project than bundled JSON,
  // or bundled JSON was stripped ({}), isolate completely so old project credentials never leak.
  if (cleanEnvProject && cleanEnvProject !== bundledProject) {
    const validEnvAuthDomain =
      cleanEnvAuthDomain && !cleanEnvAuthDomain.startsWith('gen-lang-client-')
        ? cleanEnvAuthDomain
        : `${cleanEnvProject}.firebaseapp.com`;
    const validEnvStorageBucket =
      cleanEnvStorageBucket && !cleanEnvStorageBucket.startsWith('gen-lang-client-')
        ? cleanEnvStorageBucket
        : `${cleanEnvProject}.firebasestorage.app`;

    return {
      apiKey: cleanEnvApiKey,
      authDomain: validEnvAuthDomain,
      projectId: cleanEnvProject,
      storageBucket: validEnvStorageBucket,
      messagingSenderId: cleanEnvMessagingSenderId,
      appId: cleanEnvAppId,
      firestoreDatabaseId: cleanEnvDbId || undefined,
      oAuthClientId: undefined,
    };
  }

  // Same project (or bundled projectId like "al-madina-electronics" with empty Web SDK fields):
  // Prefer clean VITE_FIREBASE_* fields and fill any missing fields from bundled JSON or canonical defaults.
  const effectiveProject = cleanEnvProject || bundledProject;
  return {
    apiKey: cleanEnvApiKey || bundledApiKey,
    authDomain: cleanEnvAuthDomain || bundledAuthDomain || (effectiveProject ? `${effectiveProject}.firebaseapp.com` : ''),
    projectId: effectiveProject,
    storageBucket:
      cleanEnvStorageBucket || bundledStorageBucket || (effectiveProject ? `${effectiveProject}.firebasestorage.app` : ''),
    messagingSenderId: cleanEnvMessagingSenderId || bundledSenderId,
    appId: cleanEnvAppId || bundledAppId,
    firestoreDatabaseId: cleanEnvDbId || bundledDbId || undefined,
    oAuthClientId: bundledConfig.oAuthClientId,
  };
}

export function getFirebaseMissingFields(cfg: FirebaseConfig = getFirebaseConfig()): string[] {
  const missing: string[] = [];
  if (isPlaceholderValue(cfg.projectId)) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (isPlaceholderValue(cfg.apiKey)) missing.push('VITE_FIREBASE_API_KEY');
  if (isPlaceholderValue(cfg.authDomain)) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (isPlaceholderValue(cfg.appId)) missing.push('VITE_FIREBASE_APP_ID');
  return missing;
}

export function getFirebaseConfig(): FirebaseConfig {
  return resolveFirebaseConfig();
}

export function isHostProjectMismatch(cfg: FirebaseConfig = getFirebaseConfig()): boolean {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return cfg.projectId !== 'al-madina-electronics';
  }
  return false;
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  if (isHostProjectMismatch(cfg)) return false;
  return !isPlaceholderConfig(cfg.projectId, cfg.apiKey) && !isPlaceholderValue(cfg.authDomain);
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let firebaseInitError: string | null = null;

if (isFirebaseConfigured()) {
  try {
    const cfg = getFirebaseConfig();
    const apps = getApps();
    const firebaseWebOptions = {
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    };
    app = apps.length > 0 ? apps[0] : initializeApp(firebaseWebOptions);
    try {
      db = cfg.firestoreDatabaseId
        ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, cfg.firestoreDatabaseId)
        : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    } catch {
      db = cfg.firestoreDatabaseId ? getFirestore(app, cfg.firestoreDatabaseId) : getFirestore(app);
    }
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      console.info('[Al-Madina ERP] Active Firebase Config:', {
        projectId: app.options.projectId,
        authDomain: app.options.authDomain,
        storageBucket: app.options.storageBucket,
        messagingSenderId: app.options.messagingSenderId,
        appId: app.options.appId,
        firestoreDatabaseId: cfg.firestoreDatabaseId || '(default)',
      });
    }
  } catch (err) {
    firebaseInitError = err instanceof Error ? err.message : String(err);
    console.error('Firebase initialization failed:', firebaseInitError);
  }
} else {
  const cfg = getFirebaseConfig();
  if (isHostProjectMismatch(cfg)) {
    firebaseInitError = `Firebase Project Mismatch on GitHub Pages: expected "al-madina-electronics", got "${cfg.projectId || '(empty)'}". Configure VITE_FIREBASE_* for al-madina-electronics.`;
  } else {
    const missing = getFirebaseMissingFields(cfg);
    firebaseInitError = `Missing Firebase Web SDK configuration: ${missing.join(', ')}`;
  }
  if (typeof window !== 'undefined') {
    console.error(`[Al-Madina ERP] Production Firebase is unconfigured (${firebaseInitError}).`);
  }
}

export function getPublicFirebaseSummary(): {
  projectId: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId: string;
  apiKeyConfigured: boolean;
} {
  const cfg = getFirebaseConfig();
  return {
    projectId: app?.options.projectId || cfg.projectId || '(none)',
    authDomain: app?.options.authDomain || cfg.authDomain || '(none)',
    storageBucket: app?.options.storageBucket || cfg.storageBucket || '(none)',
    messagingSenderId: app?.options.messagingSenderId || cfg.messagingSenderId || '(none)',
    appId: app?.options.appId || cfg.appId || '(none)',
    firestoreDatabaseId: cfg.firestoreDatabaseId || '(default)',
    apiKeyConfigured: !isPlaceholderValue(cfg.apiKey),
  };
}

export function getFirebaseRuntimeDiagnostics(): FirebaseRuntimeDiagnostics {
  const cfg = getFirebaseConfig();
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env || {};
  const cleanEnvProject = sanitizeCleanEnvField(env.VITE_FIREBASE_PROJECT_ID);
  const cleanEnvApiKey = sanitizeCleanEnvField(env.VITE_FIREBASE_API_KEY);
  const cleanEnvAppId = sanitizeCleanEnvField(env.VITE_FIREBASE_APP_ID);

  const hasAnyCleanEnv = Boolean(cleanEnvProject || cleanEnvApiKey || cleanEnvAppId);
  const fullEnvOverride = Boolean(cleanEnvProject && cleanEnvApiKey && cleanEnvProject !== firebaseConfigJson.projectId);
  const missingFields = getFirebaseMissingFields(cfg);
  const configured = isFirebaseConfigured();

  let configuredVia: FirebaseRuntimeDiagnostics['configuredVia'] = 'unconfigured';
  if (configured) {
    if (fullEnvOverride) {
      configuredVia = 'env';
    } else if (hasAnyCleanEnv) {
      configuredVia = 'merged';
    } else {
      configuredVia = 'firebase-applet-config';
    }
  }

  return {
    projectId: cfg.projectId || '(none)',
    authDomain: cfg.authDomain || '(none)',
    storageBucket: cfg.storageBucket || '(none)',
    firestoreDatabaseId: cfg.firestoreDatabaseId || '(default)',
    configuredVia,
    isConfigured: configured,
    missingFields,
    origin: typeof window !== 'undefined' ? window.location.origin : 'server',
    apiBaseUrl: getApiBaseUrl() || '(same-origin)',
    authInitialized: Boolean(auth),
    firestoreInitialized: Boolean(db),
    apiKeyPresent: !isPlaceholderValue(cfg.apiKey),
    appIdPresent: !isPlaceholderValue(cfg.appId),
    initError: firebaseInitError,
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
  provider: 'Firestore' | 'Unconfigured / Offline';
  details: string;
} {
  if (isFirebaseConfigured() && db) {
    return {
      isConfigured: true,
      provider: 'Firestore',
      details: `Connected to Cloud Firestore (${getFirebaseConfig().projectId})`,
    };
  }
  const missing = getFirebaseMissingFields();
  return {
    isConfigured: false,
    provider: 'Unconfigured / Offline',
    details: missing.length > 0
      ? `Firebase configuration missing: ${missing.join(', ')}. Production localStorage fallback is disabled.`
      : 'Cloud Firestore SDK failed to initialize. Production localStorage fallback is disabled.',
  };
}
