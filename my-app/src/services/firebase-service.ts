import { initializeApp, FirebaseOptions, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { firebaseConfig } from "../auth/firebaseConfig";

/**
 * Firebase Service - Base service that provides access to core Firebase instances
 */
class FirebaseService {
  private static instance: FirebaseService;
  private app: FirebaseApp;
  private db: Firestore;
  private auth: Auth;

  private constructor() {
    this.app = initializeApp(firebaseConfig as FirebaseOptions);
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  public getFirestore(): Firestore {
    return this.db;
  }

  public getAuth(): Auth {
    return this.auth;
  }

  public getApp(): FirebaseApp {
    return this.app;
  }
}

export default FirebaseService; 