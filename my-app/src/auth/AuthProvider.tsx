import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type User,
  type IdTokenResult,
} from "@firebase/auth";
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { getFirebaseAuth, getFirebaseDb } from "./firebaseConfig";
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

// Enhanced cache with expiration
interface CacheEntry {
  role: UserType | null;
  timestamp: number;
}

const userRoleCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const AuthProvider = ({ children }: Props): React.ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<IdTokenResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserType | null>(null);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
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
      setUser(newUser);

      if (newUser) {
        try {
          // Fetch token and role concurrently with timeout
          const tokenPromise = newUser.getIdTokenResult();
          const rolePromise = fetchUserRole(newUser.uid);

          // Add timeout to prevent hanging
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Auth timeout')), 10000);
          });

          const [tokenResult, role] = await Promise.race([
            Promise.all([tokenPromise, rolePromise]),
            timeoutPromise
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

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    userRole,
    logout
  }), [user, token, loading, userRole, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
