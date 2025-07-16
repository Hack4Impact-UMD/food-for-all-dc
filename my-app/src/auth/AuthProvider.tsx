import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type User,
  type IdTokenResult,
} from "@firebase/auth";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { app, db } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { UserType } from "../types";

interface Props {
  children: JSX.Element;
}

interface AuthContextType {
  user: User | null;
  token: IdTokenResult | null;
  loading: boolean;
  userRole: UserType | null;
  logout: () => Promise<void>;
}

// Create a default context value
const defaultAuthContext: AuthContextType = {
  user: null,
  token: null,
  loading: true,
  userRole: null,
  logout: async () => { /* Default implementation, will be replaced */ },
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Cache for user roles to avoid repeated Firestore calls
const userRoleCache = new Map<string, UserType | null>();

export const AuthProvider = ({ children }: Props): React.ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<IdTokenResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserType | null>(null);

  const logout = useCallback(async () => {
    const auth = getAuth(app);
    try {
      await signOut(auth);
      setUser(null);
      setToken(null);
      setUserRole(null);
      // Clear cache on logout
      userRoleCache.clear();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, []);

  const fetchUserRole = useCallback(async (uid: string): Promise<UserType | null> => {
    // Check cache first
    if (userRoleCache.has(uid)) {
      return userRoleCache.get(uid) || null;
    }

    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const roleString = userData.role;
        let roleEnum: UserType | null = null;

        if (roleString) {
          switch (roleString) {
            case "Admin":
              roleEnum = UserType.Admin;
              break;
            case "Manager":
              roleEnum = UserType.Manager;
              break;
            case "Client Intake":
              roleEnum = UserType.ClientIntake;
              break;
            default:
              console.warn(`Unknown role found in Firestore: ${roleString}`);
              roleEnum = null;
          }
        }

        // Cache the result
        userRoleCache.set(uid, roleEnum);
        return roleEnum;
      } else {
        console.warn(`User document not found in Firestore for UID: ${uid}`);
        userRoleCache.set(uid, null);
        return null;
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (newUser) => {
      setUser(newUser);

      if (newUser) {
        try {
          // Fetch token and role concurrently
          const [tokenResult, role] = await Promise.all([
            newUser.getIdTokenResult(),
            fetchUserRole(newUser.uid)
          ]);

          setToken(tokenResult);
          setUserRole(role);
        } catch (error) {
          console.error("Error fetching user token or role:", error);
          setToken(null);
          setUserRole(null);
        }
      } else {
        setToken(null);
        setUserRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [fetchUserRole]);

  return (
    <AuthContext.Provider value={{ user, token, loading, userRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
