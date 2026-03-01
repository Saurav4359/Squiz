import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBCwyZ2SRvMrIPC-CzFsA662z-l8jNQb5c',
  authDomain: 'seekerrank.firebaseapp.com',
  projectId: 'seekerrank',
  storageBucket: 'seekerrank.firebasestorage.app',
  messagingSenderId: '759338475212',
  appId: '1:759338475212:web:544cb78cd5f26ad83e2c69',
  measurementId: 'G-K36TKWKE7L',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
