import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
// @ts-ignore - getReactNativePersistence exists at runtime but types lag behind
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBCwyZ2SRvMrIPC-CzFsA662z-l8jNQb5c',
  authDomain: 'seekerrank.firebaseapp.com',
  projectId: 'seekerrank',
  storageBucket: 'seekerrank.firebasestorage.app',
  messagingSenderId: '759338475212',
  appId: '1:759338475212:web:544cb78cd5f26ad83e2c69',
  measurementId: 'G-K36TKWKE7L',
};

// Prevent re-initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// Initialize auth with persistence (handle hot reload)
let auth: ReturnType<typeof initializeAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized (hot reload), get existing instance
  auth = getAuth(app) as any;
}

export { auth };
export default app;
