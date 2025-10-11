import {
  collection,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, app, functions } from "../auth/firebaseConfig"; // Assuming db and app are exported from firebaseConfig
import { AuthUserRow, UserType } from "../types";
import { validateAuthUserRow } from '../utils/firestoreValidation';
import { httpsCallable } from "firebase/functions";
import { retry } from '../utils/retry';
import { ServiceError, formatServiceError } from '../utils/serviceError';
import dataSources from '../config/dataSources';

// Helper to convert Firestore role string to UserType enum
const mapRoleToUserType = (roleString: string): UserType => {
  switch (roleString?.toLowerCase()) {
    case "admin":
      return UserType.Admin;
    case "manager":
      return UserType.Manager;
    case "client intake":
      return UserType.ClientIntake;
    default:
      console.warn(`Unknown role string encountered: ${roleString}`);
      return UserType.ClientIntake; // Or handle appropriately
  }
};

export class AuthUserService {
  private static instance: AuthUserService;
  private collectionRef = collection(db, dataSources.firebase.usersCollection);
  private auth = getAuth(app); // Get Firebase Auth instance

  // Private constructor for singleton pattern
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Intentional for singleton
  private constructor() {}

  // Static method to get the singleton instance
  public static getInstance(): AuthUserService {
    if (!AuthUserService.instance) {
      AuthUserService.instance = new AuthUserService();
    }
    return AuthUserService.instance;
  }


  // Fetch all users from Firestore
  async getAllUsers(): Promise<AuthUserRow[]> {
    try {
      return await retry(async () => {
        const querySnapshot = await getDocs(this.collectionRef);
        const users: AuthUserRow[] = [];
        querySnapshot.forEach((doc: DocumentData) => {
          const data = { id: doc.id, uid: doc.id, ...doc.data(), role: mapRoleToUserType(doc.data().role) };
          if (validateAuthUserRow(data)) {
            users.push(data);
          }
        });
        return users;
      });
    } catch (error: unknown) {
      throw formatServiceError(error, 'Failed to fetch users from Firestore');
    }
  }

  /**
   * Subscribe to all users (real-time updates)
   */
  public subscribeToAllUsers(
    onData: (users: AuthUserRow[]) => void,
    onError?: (error: ServiceError) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      this.collectionRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const users: AuthUserRow[] = [];
  snapshot.forEach((doc: DocumentData) => {
          const data = { id: doc.id, uid: doc.id, ...doc.data(), role: mapRoleToUserType(doc.data().role) };
          if (validateAuthUserRow(data)) {
            users.push(data);
          }
        });
        onData(users);
      },
      (error: FirestoreError) => {
        if (onError) onError(formatServiceError(error, 'Real-time users listener error'));
      }
    );
    return unsubscribe;
  }

  /**
   * Subscribe to a user by ID (real-time updates)
   */
  public subscribeToUserById(
    uid: string,
    onData: (user: AuthUserRow | null) => void,
    onError?: (error: ServiceError) => void
  ): () => void {
    const unsubscribe = onSnapshot(
      doc(this.collectionRef, uid),
      (snapshot: DocumentData) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.name && data.email && data.role) {
            onData({
              id: snapshot.id,
              uid: snapshot.id,
              name: data.name,
              role: mapRoleToUserType(data.role),
              phone: data.phone || undefined,
              email: data.email,
            });
          } else {
            onData(null);
          }
        } else {
          onData(null);
        }
      },
      (error: FirestoreError) => {
        if (onError) onError(formatServiceError(error, 'Real-time user listener error'));
      }
    );
    return unsubscribe;
  }

  // Create a new user in Firebase Auth and Firestore
  async createUser(
    userData: Omit<AuthUserRow, "id" | "uid">,
    password: string
  ): Promise<string> {
    const currentUser = this.auth.currentUser;
    try {
      return await retry(async () => {
        const userCredential = await createUserWithEmailAndPassword(
          this.auth,
          userData.email,
          password
        );
        const userId = userCredential.user.uid;
        if (currentUser) {
          await this.auth.updateCurrentUser(currentUser);
        }
        const roleString = getRoleDisplayName(userData.role);
        const newUserDoc = {
          name: userData.name,
          email: userData.email,
          phone: userData.phone || "",
          role: roleString,
        };
        await setDoc(doc(db, "users", userId), newUserDoc);
        console.log(`User created successfully with UID: ${userId}`);
        return userId;
      });
    } catch (error: unknown) {
      if (currentUser) {
        try {
          await this.auth.updateCurrentUser(currentUser);
        } catch (restoreError) {
          console.error("Failed to restore user context after creation error:", restoreError);
        }
      }
      const err = error as Error & { code?: string; message?: string };
      if (err.code === 'auth/email-already-in-use') {
        throw formatServiceError(err, "Email already in use. Please use a different email.");
      } else if (err.code === 'auth/weak-password') {
        throw formatServiceError(err, "Password is too weak. Please choose a stronger password.");
      }
      throw formatServiceError(err, "Failed to create user. Please check the details and try again.");
    }
  }

  // Delete user document from Firestore
  // NOTE: This does NOT delete the user from Firebase Authentication.
  // Deleting from Auth requires admin privileges, typically via a Cloud Function.
  async deleteUser(uid: string): Promise<void> {
    console.log(`Initiating delete process for UID: ${uid} via Cloud Function.`);
    try {
      await retry(async () => {
        const deleteUserAccountCallable = httpsCallable(functions, 'deleteUserAccount');
        const result = await deleteUserAccountCallable({ uid: uid });
        console.log("Cloud Function deleteUserAccount result:", result.data);
        console.log(`User ${uid} delete initiated successfully via Cloud Function.`);
      });
    } catch (error: unknown) {
      const err = error as Error & { code?: string; message?: string };
      const errorMessage = err.message || "An error occurred while deleting the user account.";
      const errorCode = err.code || 'unknown';
      if (errorCode === 'functions/permission-denied' || errorCode === 'permission-denied') {
        throw formatServiceError(err, "You do not have permission to delete this user.");
      } else if (errorCode === 'functions/not-found' || errorCode === 'not-found') {
        throw formatServiceError(err, "User not found. They may have already been deleted.");
      } else if (errorCode === 'functions/invalid-argument' || errorCode === 'invalid-argument') {
        throw formatServiceError(err, "Invalid request sent to delete user function.");
      }
      throw formatServiceError(err, `Failed to delete user: ${errorMessage}`);
    }
  }
}

// Function to get display name (can be moved to a utils file if used elsewhere)
const getRoleDisplayName = (type: UserType): string => {
    switch (type) {
        case UserType.Admin: return "Admin";
        case UserType.Manager: return "Manager";
        case UserType.ClientIntake: return "Client Intake"; // Use the display name
        default: return "Unknown";
    }
};

// Export a singleton instance
export const authUserService = AuthUserService.getInstance(); 