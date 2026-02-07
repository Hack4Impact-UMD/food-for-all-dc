import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableNetwork } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { getFunctions, Functions, connectFunctionsEmulator } from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  AppCheck,
} from "firebase/app-check";
import { firebaseConfig } from "../config/apiKeys";

const app: FirebaseApp = initializeApp(firebaseConfig);

// Lazy initialization of Firebase services
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let functionsInstance: Functions | null = null;
let appCheckInstance: AppCheck | null = null;

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

export const getFirebaseAppCheck = (): AppCheck | null => {
  if (appCheckInstance) {
    return appCheckInstance;
  }

  const siteKey = process.env.REACT_APP_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) {
    console.warn("REACT_APP_FIREBASE_APPCHECK_SITE_KEY is not set; App Check is disabled.");
    return null;
  }

  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheckInstance;
};

export const getAppCheckToken = async (): Promise<string | null> => {
  const appCheck = getFirebaseAppCheck();
  if (!appCheck) {
    return null;
  }

  try {
    const tokenResult = await getToken(appCheck, false);
    return tokenResult.token || null;
  } catch (error) {
    console.warn("Failed to acquire App Check token:", error);
    return null;
  }
};

export const db = getFirebaseDb();
export const auth = getFirebaseAuth();
export const functions = getFirebaseFunctions();

export { app };
