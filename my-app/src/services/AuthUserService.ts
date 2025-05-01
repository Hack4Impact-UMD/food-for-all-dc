import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, deleteUser as deleteFirebaseAuthUser } from "firebase/auth";
import { db, app } from "../auth/firebaseConfig"; // Assuming db and app are exported from firebaseConfig
import { AuthUserRow, UserType } from "../types";

// Helper to convert Firestore role string to UserType enum
const mapRoleToUserType = (roleString: string): UserType => {
  switch (roleString?.toLowerCase()) {
    case "admin":
      return UserType.Admin;
    case "manager":
      return UserType.Manager;
    case "client intake": // Match Firestore data which might not be enum keys
      return UserType.ClientIntake;
    default:
      // Handle unknown or missing roles appropriately
      console.warn(`Unknown role string encountered: ${roleString}`);
      // Decide on a default or throw an error if necessary
      // For now, let's default to ClientIntake or throw an error? Let's default safely.
      // Returning null might be better if the calling code handles it.
      // For spreadsheet display, a default might be okay.
      return UserType.ClientIntake; // Or handle as an error/unknown state
  }
};


export class AuthUserService {
  private static instance: AuthUserService;
  private collectionRef = collection(db, "users");
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
      const querySnapshot = await getDocs(this.collectionRef);
      const users: AuthUserRow[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Basic validation to ensure essential fields exist
        if (data.name && data.email && data.role) {
           users.push({
             id: doc.id,
             uid: doc.id, // Assuming Firestore doc ID is the Auth UID
             name: data.name,
             // Map the role string from Firestore to the UserType enum
             role: mapRoleToUserType(data.role),
             phone: data.phone || undefined, // Handle optional phone
             email: data.email,
           });
        } else {
            console.warn(`Skipping user doc ${doc.id} due to missing required fields (name, email, or role).`);
        }
      });
      return users;
    } catch (error) {
      console.error("Error fetching users from Firestore: ", error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  // Create a new user in Firebase Auth and Firestore
  async createUser(
    userData: Omit<AuthUserRow, "id" | "uid">,
    password: string
  ): Promise<string> { // Return the new user's UID
    const currentUser = this.auth.currentUser; // Store current user
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        userData.email,
        password
      );
      const userId = userCredential.user.uid;

      // Restore the original user context if needed
      if (currentUser) {
         await this.auth.updateCurrentUser(currentUser); // Important: Restore admin/manager context
      }


      // Prepare data for Firestore, mapping enum back to string if needed
      // Let's store the role as a string consistent with existing data
      const roleString = userData.role.toString(); // Use the enum value directly as string for now

      const newUserDoc = {
        name: userData.name,
        email: userData.email,
        phone: userData.phone || "", // Store empty string if undefined
        role: roleString, // Store role as string
      };

      // Add user document to Firestore with UID as document ID
      await setDoc(doc(db, "users", userId), newUserDoc);

      console.log(`User created successfully with UID: ${userId}`);
      return userId; // Return the UID of the created user

    } catch (error) {
       // Restore the original user context in case of error too
       if (currentUser) {
         try {
           await this.auth.updateCurrentUser(currentUser);
         } catch (restoreError) {
           console.error("Failed to restore user context after creation error:", restoreError);
         }
       }
      console.error("Error creating user:", error);
      // Provide more specific error feedback if possible
      if ((error as any).code === 'auth/email-already-in-use') {
          throw new Error("Email already in use. Please use a different email.");
      } else if ((error as any).code === 'auth/weak-password') {
          throw new Error("Password is too weak. Please choose a stronger password.");
      }
      throw new Error("Failed to create user. Please check the details and try again."); // Generic error
    }
  }

  // Delete user document from Firestore
  // NOTE: This does NOT delete the user from Firebase Authentication.
  // Deleting from Auth requires admin privileges, typically via a Cloud Function.
  async deleteUser(uid: string): Promise<void> {
    try {
        // TODO: Implement Cloud Function call here to delete from Firebase Auth first.
        // For now, we only delete from Firestore.
        const userDocRef = doc(db, "users", uid);
        await deleteDoc(userDocRef);
        console.log(`User document ${uid} deleted successfully from Firestore.`);
        // We should also call the backend function to delete the Auth user here
        // Example: await deleteUserAccount(uid); // Hypothetical function call
    } catch (error) {
      console.error(`Error deleting user document ${uid} from Firestore: `, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const authUserService = AuthUserService.getInstance(); 