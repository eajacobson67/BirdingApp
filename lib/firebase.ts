import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your Firebase project config from https://console.firebase.google.com
const firebaseConfig = {
  apiKey: "AIzaSyA96oYtGFmXuXoDc06e9_GITo9pJXMeJfc",
  authDomain: "birding-app-1a446.firebaseapp.com",
  projectId: "birding-app-1a446",
  storageBucket: "birding-app-1a446.firebasestorage.app",
  messagingSenderId: "132532463413",
  appId: "1:132532463413:web:f00efac1f0051e0edf4e7c",
  measurementId: "G-ZSQP1V8LZK"
};

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
