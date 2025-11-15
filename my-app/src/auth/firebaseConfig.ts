import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableNetwork, disableNetwork } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getFunctions, Functions, connectFunctionsEmulator } from "firebase/functions";
import { firebaseConfig } from "../config/apiKeys";

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
    if (process.env.NODE_ENV === "production") {
      enableNetwork(firestoreInstance).catch((err: unknown) => {
        console.warn("Firestore network enable failed:", err);
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
    if (process.env.NODE_ENV === "development") {
      try {
        connectFunctionsEmulator(functionsInstance, "localhost", 5001);
      } catch (err) {
        console.warn("Functions emulator connection failed:", err);
      }
    }
  }
  return functionsInstance;
};

export const db = getFirebaseDb();
export const auth = getFirebaseAuth();
export const functions = getFirebaseFunctions();

export { app };
