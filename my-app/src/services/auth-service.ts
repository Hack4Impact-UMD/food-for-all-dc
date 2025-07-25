import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  UserCredential,
  IdTokenResult,
} from "firebase/auth";
import { AuthError } from "../types/user-types";
import FirebaseService from "./firebase-service";

/**
 * Auth Service - Handles all authentication-related operations with Firebase
 */
class AuthService {
  private static instance: AuthService;
  private auth = FirebaseService.getInstance().getAuth();

  // Private constructor to prevent direct instantiation
  // This is part of the singleton pattern
  private constructor() {
    // Intentionally empty - initialization happens with class properties
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Sign in a user with email and password
   */
  public async signIn(email: string, password: string): Promise<UserCredential> {
    try {
      return await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error: any) {
      const authError: AuthError = {
        code: error.code || "auth/signin-error",
        message:
          error.code === "auth/user-not-found" || error.code === "auth/wrong-password"
            ? "Invalid email or password."
            : error.message || "Error signing in."
      };
      console.error("Error signing in:", authError);
      throw authError;
    }
  }

  /**
   * Create a new user with email and password
   */
  public async createUser(email: string, password: string): Promise<UserCredential> {
    try {
      return await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (error: any) {
      const authError: AuthError = {
        code: error.code || "auth/createuser-error",
        message: error.message || "Error creating user."
      };
      console.error("Error creating user:", authError);
      throw authError;
    }
  }

  /**
   * Sign out the current user
   */
  public async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error: any) {
      const authError: AuthError = {
        code: error.code || "auth/signout-error",
        message: error.message || "Error signing out."
      };
      console.error("Error signing out:", authError);
      throw authError;
    }
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      const authError: AuthError = {
        code: error.code || "auth/reset-error",
        message:
          error.code === "auth/user-not-found"
            ? "No account found with that email address."
            : error.message || "Error sending password reset email."
      };
      console.error("Error sending password reset email:", authError);
      throw authError;
    }
  }

  /**
   * Get the current user
   */
  public getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /**
   * Listen for auth state changes
   */
  public onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(this.auth, callback);
  }

  /**
   * Get user claims from token
   */
  public async getUserClaims(user: User): Promise<IdTokenResult> {
    try {
      return await user.getIdTokenResult();
    } catch (error: any) {
      const authError: AuthError = {
        code: error.code || "auth/claims-error",
        message: error.message || "Error getting user claims."
      };
      console.error("Error getting user claims:", authError);
      throw authError;
    }
  }
}

export default AuthService; 