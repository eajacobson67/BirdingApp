import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Which Firebase project this build talks to is picked by Expo's built-in
// env-file loading, not by anything in this file:
//   npx expo start / npx expo run:android (debug)  -> NODE_ENV=development -> .env.development -> birdapp-dev-birdleague
//   ./gradlew bundleRelease / assembleRelease       -> NODE_ENV=production  -> .env.production  -> birding-app-1a446 (real users)
// See docs/RELEASE.md and .env.development/.env.production. Firebase web
// config is not a secret (Google's own docs say so) — real access control is
// firestore.rules/storage.rules, not this key.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// A silently-undefined projectId would mean every read/write fails at runtime
// with an opaque network error, far from this file. Fail immediately instead.
if (!firebaseConfig.projectId) {
  throw new Error(
    'Firebase config is missing (EXPO_PUBLIC_FIREBASE_PROJECT_ID unset). ' +
    'Check .env.development / .env.production exist and restart Metro — env files are only read at startup.',
  );
}

if (__DEV__) {
  console.log(`[firebase] connected to project: ${firebaseConfig.projectId}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// getReactNativePersistence is in Firebase's RN bundle (dist/rn/index.js) which Metro
// resolves via the "react-native" field in @firebase/auth/package.json, but TypeScript
// doesn't see it in the type declarations. require() bypasses that gap safely.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('@firebase/auth');

function getOrInitAuth() {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
}

export const auth = getOrInitAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
