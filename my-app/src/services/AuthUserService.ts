import {
  collection,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  FirestoreError,
  writeBatch,
} from "firebase/firestore";
import { db, functions } from "../auth/firebaseConfig";
import { AuthUserRow, UserType } from "../types";
import { validateAuthUserRow } from "../utils/firestoreValidation";
import { httpsCallable } from "firebase/functions";
import { retry } from "../utils/retry";
import { ServiceError, formatServiceError } from "../utils/serviceError";
import dataSources from "../config/dataSources";
import { formatPhoneNumberForSave } from "../utils/format";

const mapRoleToUserType = (roleString: string): UserType => {
  switch (roleString?.toLowerCase()) {
    case "admin":
      return UserType.Admin;
    case "manager":
      return UserType.Manager;
    case "client intake":
      return UserType.ClientIntake;
    default:
      return UserType.ClientIntake;
  }
};

export class AuthUserService {
  private static instance: AuthUserService;
  private collectionRef = collection(db, dataSources.firebase.usersCollection);

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Intentional for singleton
  private constructor() {}

  public static getInstance(): AuthUserService {
    if (!AuthUserService.instance) {
      AuthUserService.instance = new AuthUserService();
    }
    return AuthUserService.instance;
  }

  async getAllUsers(): Promise<AuthUserRow[]> {
    try {
      return await retry(async () => {
        const querySnapshot = await getDocs(this.collectionRef);
        const users: AuthUserRow[] = [];
        querySnapshot.forEach((doc: DocumentData) => {
          const data = {
            id: doc.id,
            uid: doc.id,
            ...doc.data(),
            role: mapRoleToUserType(doc.data().role),
          };
          if (validateAuthUserRow(data)) {
            users.push(data);
          }
        });
        return users;
      });
    } catch (error: unknown) {
      throw formatServiceError(error, "Failed to fetch users from Firestore");
    }
  }

  async normalizeExistingUserPhoneNumbers(users: AuthUserRow[]): Promise<AuthUserRow[]> {
    const normalizedUsers = users.map((user) => {
      const formattedPhone = formatPhoneNumberForSave(user.phone || "");
      return formattedPhone !== null && formattedPhone !== (user.phone || "")
        ? { ...user, phone: formattedPhone || undefined }
        : user;
    });
    const changedUsers = normalizedUsers.filter(
      (user, index) => user.phone !== users[index].phone
    );

    try {
      for (let index = 0; index < changedUsers.length; index += 450) {
        const batch = writeBatch(db);
        changedUsers.slice(index, index + 450).forEach((user) => {
          batch.set(
            doc(db, dataSources.firebase.usersCollection, user.uid),
            { phone: user.phone || "" },
            { merge: true }
          );
        });
        await batch.commit();
      }
      return normalizedUsers;
    } catch (error: unknown) {
      throw formatServiceError(error, "Failed to normalize existing user phone numbers.");
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
          const data = {
            id: doc.id,
            uid: doc.id,
            ...doc.data(),
            role: mapRoleToUserType(doc.data().role),
          };
          if (validateAuthUserRow(data)) {
            users.push(data);
          }
        });
        onData(users);
      },
      (error: FirestoreError) => {
        if (onError) onError(formatServiceError(error, "Real-time users listener error"));
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
        if (onError) onError(formatServiceError(error, "Real-time user listener error"));
      }
    );
    return unsubscribe;
  }

  async createUser(userData: Omit<AuthUserRow, "id" | "uid">, password: string): Promise<string> {
    const formattedPhone = formatPhoneNumberForSave(userData.phone || "");
    if (formattedPhone === null) {
      throw new Error("Phone number must use one of the allowed formats.");
    }
    try {
      const createUserAccountCallable = httpsCallable<
        { name: string; email: string; phone: string; role: string; password: string },
        { uid: string }
      >(functions, "createUserAccount");
      const result = await createUserAccountCallable({
        name: userData.name.trim(),
        email: userData.email.trim(),
        phone: formattedPhone,
        role: getRoleDisplayName(userData.role),
        password,
      });
      if (!result.data?.uid) {
        throw new Error("User creation completed without returning a user ID.");
      }
      return result.data.uid;
    } catch (error: unknown) {
      const err = error as Error & { code?: string; message?: string };
      if (
        err.code === "functions/already-exists" ||
        err.code === "already-exists" ||
        err.code === "auth/email-already-in-use"
      ) {
        throw formatServiceError(err, "Email already in use. Please use a different email.");
      } else if (
        err.code === "functions/invalid-argument" ||
        err.code === "invalid-argument" ||
        err.code === "auth/weak-password"
      ) {
        throw formatServiceError(err, "Password is too weak or the user details are invalid.");
      } else if (err.code === "functions/permission-denied" || err.code === "permission-denied") {
        throw formatServiceError(err, "You do not have permission to create this user.");
      }
      throw formatServiceError(
        err,
        "Failed to create user. Please check the details and try again."
      );
    }
  }

  async updateUser(
    uid: string,
    updates: Pick<AuthUserRow, "name" | "phone" | "role">
  ): Promise<void> {
    const formattedPhone = formatPhoneNumberForSave(updates.phone || "");
    if (formattedPhone === null) {
      throw new Error("Phone number must use one of the allowed formats.");
    }

    try {
      await retry(async () => {
        await setDoc(
          doc(db, dataSources.firebase.usersCollection, uid),
          {
            name: updates.name.trim(),
            phone: formattedPhone,
            role: getRoleDisplayName(updates.role),
          },
          { merge: true }
        );
      });
    } catch (error: unknown) {
      throw formatServiceError(error, "Failed to update user. Please try again.");
    }
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      const deleteUserAccountCallable = httpsCallable(functions, "deleteUserAccount");
      await deleteUserAccountCallable({ uid });
    } catch (error: unknown) {
      const err = error as Error & { code?: string; message?: string };
      const errorMessage = err.message || "An error occurred while deleting the user account.";
      const errorCode = err.code || "unknown";
      if (errorCode === "functions/permission-denied" || errorCode === "permission-denied") {
        throw formatServiceError(err, "You do not have permission to delete this user.");
      } else if (errorCode === "functions/not-found" || errorCode === "not-found") {
        throw formatServiceError(err, "User not found. They may have already been deleted.");
      } else if (errorCode === "functions/invalid-argument" || errorCode === "invalid-argument") {
        throw formatServiceError(err, "Invalid request sent to delete user function.");
      }
      throw formatServiceError(err, `Failed to delete user: ${errorMessage}`);
    }
  }
}

const getRoleDisplayName = (type: UserType): string => {
  switch (type) {
    case UserType.Admin:
      return "Admin";
    case UserType.Manager:
      return "Manager";
    case UserType.ClientIntake:
      return "Client Intake";
    default:
      return "Unknown";
  }
};

export const authUserService = AuthUserService.getInstance();
