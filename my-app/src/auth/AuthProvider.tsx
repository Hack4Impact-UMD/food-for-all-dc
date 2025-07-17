import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type IdTokenResult,
} from "@firebase/auth";
import { AuthUser, AuthError } from "../types/user-types";
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getFirebaseAuth, getFirebaseDb } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { UserType } from "../types";

export interface AuthContextType {
  user: AuthUser | null;
  token: IdTokenResult | null;
  loading: boolean;
  userRole: UserType | null;
  error: AuthError | null;
  logout: () => Promise<void>;
}

interface Props {
  children: JSX.Element;
}

// Create a default context value
const defaultAuthContext: AuthContextType = {
  user: null,
  token: null,
  loading: true,
  userRole: null,
  error: null,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  logout: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Enhanced cache with expiration
interface CacheEntry {
  role: UserType | null;
  timestamp: number;
}

const userRoleCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const AuthProvider = ({ children }: Props): React.ReactElement => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<IdTokenResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserType | null>(null);
  const [error, setError] = useState<AuthError | null>(null);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    try {
      await signOut(auth);
      setUser(null);
      setToken(null);
      setUserRole(null);
      setError(null);
      userRoleCache.clear();
    } catch (err: any) {
      setError({ code: err.code || "auth/logout-error", message: err.message || "Logout failed." });
      console.error("Logout error:", err);
    }
  }, []);

  const fetchUserRole = useCallback(async (uid: string): Promise<UserType | null> => {
    // Check cache first with expiration
    const cachedEntry = userRoleCache.get(uid);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_DURATION) {
      return cachedEntry.role;
    }

    try {
      const db = getFirebaseDb();
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

        // Cache the result with timestamp
        userRoleCache.set(uid, {
          role: roleEnum,
          timestamp: Date.now()
        });
        return roleEnum;
      } else {
        console.warn(`User document not found in Firestore for UID: ${uid}`);
        userRoleCache.set(uid, {
          role: null,
          timestamp: Date.now()
        });
        return null;
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (newUser) => {
      if (newUser) {
        // Map Firebase User to AuthUser
        const mappedUser: AuthUser = {
          uid: newUser.uid,
          email: newUser.email,
          displayName: newUser.displayName,
          photoURL: newUser.photoURL,
          emailVerified: newUser.emailVerified,
          phoneNumber: newUser.phoneNumber,
          providerId: newUser.providerId,
        };
        setUser(mappedUser);
        try {
          const tokenPromise = newUser.getIdTokenResult();
          const rolePromise = fetchUserRole(newUser.uid);
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Auth timeout')), 10000);
          });
          const [tokenResult, role] = await Promise.race([
            Promise.all([tokenPromise, rolePromise]),
            timeoutPromise
          ]);
          setToken(tokenResult);
          setUserRole(role);
          setError(null);
        } catch (err: any) {
          setToken(null);
          setUserRole(null);
          setError({ code: err.code || "auth/token-role-error", message: err.message || "Failed to fetch token or role." });
          console.error("Error fetching user token or role:", err);
        }
      } else {
        setUser(null);
        setToken(null);
        setUserRole(null);
        setError(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [fetchUserRole]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    userRole,
    error,
    logout
  }), [user, token, loading, userRole, error, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
