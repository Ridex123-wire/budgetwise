
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDxBqVOEKX13zWWYsaXQ_EAvrVylM74GlA",
  authDomain: "budgetwise-8d741.firebaseapp.com",
  projectId: "budgetwise-8d741",
  storageBucket: "budgetwise-8d741.firebasestorage.app",
  messagingSenderId: "418020342759",
  appId: "1:418020342759:web:1d1fe867dc1eb0d9fd5b42",
  measurementId: "G-B4D2E2L24G"
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;