import {
  collection,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, app, functions } from "../auth/firebaseConfig"; // Assuming db and app are exported from firebaseConfig
import { AuthUserRow, UserType } from "../types";
import { httpsCallable } from "firebase/functions";

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

      // Get the string representation of the UserType enum
      // Ensure this matches how roles are displayed/stored if different from enum keys
      const roleString = getRoleDisplayName(userData.role); // Use helper for consistency

      const newUserDoc = {
        name: userData.name,
        email: userData.email,
        phone: userData.phone || "", // Store empty string if undefined
        role: roleString, // Store consistent role string (e.g., "Client Intake")
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
    console.log(`Initiating delete process for UID: ${uid} via Cloud Function.`);
    try {
        // Get a reference to the Cloud Function
        const deleteUserAccountCallable = httpsCallable(functions, 'deleteUserAccount');

        // Call the Cloud Function with the UID
        // The Cloud Function now handles both Auth and Firestore deletion
        const result = await deleteUserAccountCallable({ uid: uid });

        // Optional: Log success result from function
        console.log("Cloud Function deleteUserAccount result:", result.data);
        console.log(`User ${uid} delete initiated successfully via Cloud Function.`);

    } catch (error: any) { // Catch potential errors from the callable function
        // Log the specific error from the Cloud Function
        console.error(`Error calling deleteUserAccount Cloud Function for UID ${uid}:`, error);

        // Re-throw a more user-friendly error or the specific error message
        // The 'error' object from httpsCallable often has useful 'code' and 'message' properties
        const errorMessage = error.message || "An error occurred while deleting the user account.";
        const errorCode = error.code || 'unknown'; // Firebase function errors often have a code (e.g., 'functions/permission-denied')

        // Customize the message based on the error code from the function
        if (errorCode === 'functions/permission-denied' || errorCode === 'permission-denied') {
             throw new Error("You do not have permission to delete this user.");
        } else if (errorCode === 'functions/not-found' || errorCode === 'not-found') {
             throw new Error("User not found. They may have already been deleted.");
        } else if (errorCode === 'functions/invalid-argument' || errorCode === 'invalid-argument') {
            throw new Error("Invalid request sent to delete user function.");
        }
        // Throw a generic message for other/unknown errors
        throw new Error(`Failed to delete user: ${errorMessage}`);
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