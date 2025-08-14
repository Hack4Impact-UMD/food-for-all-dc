// Firebase initialization for app usage (not for tests)
// WARNING: Do NOT import this file in test code. Use only in app/service code to avoid real Firebase calls in tests.
// For production, consider loading firebaseConfig from environment variables instead of hardcoding.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCasSjeF-YMoHYZFfLWz96fGgNjYKOqRak", // Or use process.env.REACT_APP_FIREBASE_API_KEY
  authDomain: "food-for-all-dc-caf23.firebaseapp.com", // Or use process.env.REACT_APP_FIREBASE_AUTH_DOMAIN
  projectId: "food-for-all-dc-caf23", // Or use process.env.REACT_APP_FIREBASE_PROJECT_ID
  storageBucket: "food-for-all-dc-caf23.firebasestorage.app", // Or use process.env.REACT_APP_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "251910218620", // Or use process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:251910218620:web:6be93fdd5aae8b811d3af9", // Or use process.env.REACT_APP_FIREBASE_APP_ID
  measurementId: "G-GE0VWH1PQX", // Or use process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
