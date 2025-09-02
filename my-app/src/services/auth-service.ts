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
import { auth } from "./firebase";
import { retry } from "../utils/retry";
import { ServiceError, formatServiceError } from "../utils/serviceError";

/**
 * Auth Service - Handles all authentication-related operations with Firebase
 */
class AuthService {
  private static instance: AuthService;
  private auth = auth;

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
      return await retry(() => signInWithEmailAndPassword(this.auth, email, password));
    } catch (error: any) {
      throw formatServiceError(error, "Error signing in.");
    }
  }

  /**
   * Create a new user with email and password
   */
  public async createUser(email: string, password: string): Promise<UserCredential> {
    try {
      return await retry(() => createUserWithEmailAndPassword(this.auth, email, password));
    } catch (error: any) {
      throw formatServiceError(error, "Error creating user.");
    }
  }

  /**
   * Sign out the current user
   */
  public async signOut(): Promise<void> {
    try {
      await retry(() => signOut(this.auth));
    } catch (error: any) {
      throw formatServiceError(error, "Error signing out.");
    }
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await retry(() => sendPasswordResetEmail(this.auth, email));
    } catch (error: any) {
      throw formatServiceError(error, "Error sending password reset email.");
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
      return await retry(() => user.getIdTokenResult());
    } catch (error: any) {
      throw formatServiceError(error, "Error getting user claims.");
    }
  }
}

export default AuthService;
