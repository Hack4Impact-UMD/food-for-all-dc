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
import FirebaseService from "./firebase-service";

/**
 * Auth Service - Handles all authentication-related operations with Firebase
 */
class AuthService {
  private static instance: AuthService;
  private auth = FirebaseService.getInstance().getAuth();

  private constructor() {}

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
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  /**
   * Create a new user with email and password
   */
  public async createUser(email: string, password: string): Promise<UserCredential> {
    try {
      return await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  public async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
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
    } catch (error) {
      console.error("Error getting user claims:", error);
      throw error;
    }
  }
}

export default AuthService; 