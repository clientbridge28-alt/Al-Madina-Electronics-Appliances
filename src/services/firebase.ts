import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, doc, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  };
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(
    cfg.apiKey && 
    cfg.apiKey !== 'YOUR_FIREBASE_API_KEY' &&
    cfg.projectId && 
    cfg.projectId !== 'YOUR_FIREBASE_PROJECT_ID'
  );
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    const apps = getApps();
    app = apps.length > 0 ? apps[0] : initializeApp(getFirebaseConfig());
    db = getFirestore(app);
    auth = getAuth(app);
    console.info('Connected to Firebase Cloud Firestore:', getFirebaseConfig().projectId);
  } catch (err) {
    console.warn('Firebase initialization skipped or failed:', err);
  }
}

export { app, db, auth };

/**
 * Cloud persistence synchronization status helper
 */
export function getCloudPersistenceStatus(): {
  isConfigured: boolean;
  provider: 'Firestore' | 'LocalStorage Engine';
  details: string;
} {
  if (isFirebaseConfigured() && db) {
    return {
      isConfigured: true,
      provider: 'Firestore',
      details: `Connected to Cloud Firestore (${getFirebaseConfig().projectId})`
    };
  }
  return {
    isConfigured: false,
    provider: 'LocalStorage Engine',
    details: 'Running offline persistent local database. Add Firebase credentials in .env to activate Cloud Firestore.'
  };
}
