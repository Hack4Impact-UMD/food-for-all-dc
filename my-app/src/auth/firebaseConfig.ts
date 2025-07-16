import { initializeApp, FirebaseOptions, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableNetwork, disableNetwork } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getFunctions, Functions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCasSjeF-YMoHYZFfLWz96fGgNjYKOqRak",
  authDomain: "food-for-all-dc-caf23.firebaseapp.com",
  projectId: "food-for-all-dc-caf23",
  storageBucket: "food-for-all-dc-caf23.appspot.com",
  messagingSenderId: "251910218620",
  appId: "1:251910218620:web:6be93fdd5aae8b811d3af9",
  measurementId: "G-GE0VWH1PQX",
};

// Initialize Firebase app once
const app: FirebaseApp = initializeApp(firebaseConfig);

// Lazy initialization of Firebase services
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _functions: Functions | null = null;

export const getFirebaseDb = (): Firestore => {
  if (!_db) {
    _db = getFirestore(app);
    
    // Enable offline capabilities for better performance
    if (process.env.NODE_ENV === 'production') {
      enableNetwork(_db).catch((err: any) => {
        console.warn('Firestore network enable failed:', err);
      });
    }
  }
  return _db;
};

export const getFirebaseAuth = (): Auth => {
  if (!_auth) {
    _auth = getAuth(app);
    _auth.useDeviceLanguage();
  }
  return _auth;
};

export const getFirebaseFunctions = (): Functions => {
  if (!_functions) {
    _functions = getFunctions(app);
    
    // Connect to emulator in development
    if (process.env.NODE_ENV === 'development') {
      try {
        connectFunctionsEmulator(_functions, 'localhost', 5001);
      } catch (err) {
        // Emulator connection failed or already connected
      }
    }
  }
  return _functions;
};

// Backwards compatibility - these will be lazy-loaded
export const db = getFirebaseDb();
export const auth = getFirebaseAuth();
export const functions = getFirebaseFunctions();

export { firebaseConfig, app };
