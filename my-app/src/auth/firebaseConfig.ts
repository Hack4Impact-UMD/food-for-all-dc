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
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let functionsInstance: Functions | null = null;

/**
 * Returns the Firestore instance, initializing if necessary.
 * Enables offline capabilities in production.
 */
export const getFirebaseDb = (): Firestore => {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app);
    if (process.env.NODE_ENV === 'production') {
      enableNetwork(firestoreInstance).catch((err: unknown) => {
        console.warn('Firestore network enable failed:', err);
      });
    }
  }
  return firestoreInstance;
};

/**
 * Returns the Auth instance, initializing if necessary.
 * Sets device language for authentication.
 */
export const getFirebaseAuth = (): Auth => {
  if (!authInstance) {
    authInstance = getAuth(app);
    authInstance.useDeviceLanguage();
  }
  return authInstance;
};

/**
 * Returns the Functions instance, initializing if necessary.
 * Connects to emulator in development mode.
 */
export const getFirebaseFunctions = (): Functions => {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app);
    if (process.env.NODE_ENV === 'development') {
      try {
        connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
      } catch (err) {
        console.warn('Functions emulator connection failed:', err);
      }
    }
  }
  return functionsInstance;
};

// Backwards compatibility - these will be lazy-loaded
export const db = getFirebaseDb();
export const auth = getFirebaseAuth();
export const functions = getFirebaseFunctions();

export { firebaseConfig, app };
