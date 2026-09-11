import { onAuthStateChanged, signOut, type IdTokenResult } from "firebase/auth";
import { AuthUser, AuthError } from "../types/user-types";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { getFirebaseAuth, getFirebaseDb } from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import dataSources from "../config/dataSources";
import { UserType } from "../types";

export interface AuthContextType {
  user: AuthUser | null;
  name: string | null;
  token: IdTokenResult | null;
  loading: boolean;
  userRole: UserType | null;
  error: AuthError | null;
  logout: () => Promise<void>;
}

interface Props {
  children: React.ReactNode;
}

// Create a default context value
const defaultAuthContext: AuthContextType = {
  user: null,
  name: null,
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
  name: string | null;
  timestamp: number;
}

const userRoleCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const AUTH_TIMEOUT = 10000;
const PROFILE_LOOKUP_ATTEMPTS = 3;
const PROFILE_RETRY_BASE_DELAY = 300;

/** Error carrying a stable `code`, matching the shape the auth listener reports. */
const codedError = (code: string, message: string): Error & { code: string } =>
  Object.assign(new Error(message), { code });

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Single Firestore read. Throws on failure so callers can retry. */
const readUserProfile = async (
  uid: string
): Promise<{ role: UserType | null; name: string | null }> => {
  const db = getFirebaseDb();
  const userDocRef = doc(db, dataSources.firebase.usersCollection, uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    return { role: null, name: null };
  }

  const userData = userDoc.data();
  const roleString = userData.role;
  const userName = userData.name ?? null;
  let roleEnum: UserType | null = null;

  if (typeof roleString === "string") {
    switch (roleString.trim().toLowerCase()) {
      case "admin":
        roleEnum = UserType.Admin;
        break;
      case "manager":
        roleEnum = UserType.Manager;
        break;
      case "client intake":
        roleEnum = UserType.ClientIntake;
        break;
      default:
        roleEnum = null;
    }
  }

  return { role: roleEnum, name: userName };
};

export const AuthProvider = ({ children }: Props): React.ReactElement => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [token, setToken] = useState<IdTokenResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserType | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  // signOut() re-enters this listener with a null user, which clears auth state.
  // The reason we are ejecting the session is handed to that event so it survives.
  const pendingAuthErrorRef = useRef<AuthError | null>(null);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    try {
      await signOut(auth);
      setUser(null);
      setName(null);
      setToken(null);
      setUserRole(null);
      setError(null);
      userRoleCache.clear();
      // Clear spreadsheet cache keys on logout for extra safety
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("clientsLastRefreshDate");
        window.localStorage.removeItem("forceClientsRefresh");
      }
    } catch (err: any) {
      setError({ code: err.code || "auth/logout-error", message: err.message || "Logout failed." });
      console.error("Logout error:", err);
    }
  }, []);

  const fetchUserProfile = useCallback(
    async (uid: string): Promise<{ role: UserType | null; name: string | null }> => {
      // Check cache first with expiration
      const cachedEntry = userRoleCache.get(uid);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
        return { role: cachedEntry.role, name: cachedEntry.name };
      }

      // A lookup that never completed is not the same as an account with no role,
      // so retry transient Firestore failures before giving up.
      let lastError: unknown;
      for (let attempt = 1; attempt <= PROFILE_LOOKUP_ATTEMPTS; attempt++) {
        try {
          const profile = await readUserProfile(uid);
          // Only a completed lookup is cacheable.
          userRoleCache.set(uid, { ...profile, timestamp: Date.now() });
          return profile;
        } catch (error) {
          lastError = error;
          if (attempt < PROFILE_LOOKUP_ATTEMPTS) {
            await delay(PROFILE_RETRY_BASE_DELAY * attempt);
          }
        }
      }

      console.error("Error fetching user role after retries:", lastError);
      throw codedError(
        "auth/profile-unavailable",
        "We couldn't verify your account right now. Check your connection and try again."
      );
    },
    []
  );

  useEffect(() => {
    const auth = getFirebaseAuth();
    let authEventId = 0;
    const unsubscribe = onAuthStateChanged(auth, async (newUser: any) => {
      const eventId = ++authEventId;
      if (newUser) {
        pendingAuthErrorRef.current = null;
        setLoading(true);
        setUser(null);
        setName(null);
        setToken(null);
        setUserRole(null);
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
        try {
          const tokenPromise = newUser.getIdTokenResult();
          const rolePromise = fetchUserProfile(newUser.uid);
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(codedError("auth/timeout", "Signing in took too long. Please try again.")),
              AUTH_TIMEOUT
            );
          });
          let tokenResult: IdTokenResult;
          let role: UserType | null;
          let name: string | null;
          try {
            [tokenResult, { role, name }] = await Promise.race([
              Promise.all([tokenPromise, rolePromise]),
              timeoutPromise,
            ]);
          } finally {
            clearTimeout(timeoutHandle);
          }
          if (eventId !== authEventId) {
            return;
          }
          if (!role) {
            throw codedError(
              "auth/missing-role",
              "This account isn't set up with an application role yet. Please contact an administrator."
            );
          }
          setUser(mappedUser);
          setToken(tokenResult);
          setUserRole(role);
          setName(name);
          setError(null);
        } catch (err: any) {
          if (eventId !== authEventId) {
            return;
          }
          const authError: AuthError = {
            code: err?.code || "auth/token-role-error",
            message: err?.message || "Failed to fetch token or role.",
          };
          console.error("Error fetching user token or role:", err);
          userRoleCache.delete(newUser.uid);
          // Hand the reason to the null-user event that signOut is about to fire,
          // otherwise it clears the error before anyone can read it.
          pendingAuthErrorRef.current = authError;
          try {
            await signOut(auth);
          } catch (signOutError) {
            console.error("Error signing out invalid session:", signOutError);
          }
          if (eventId !== authEventId) {
            // The null-user event already cleared the session and applied the error.
            return;
          }
          pendingAuthErrorRef.current = null;
          setUser(null);
          setToken(null);
          setName(null);
          setUserRole(null);
          setError(authError);
        }
      } else {
        const pendingAuthError = pendingAuthErrorRef.current;
        pendingAuthErrorRef.current = null;
        setUser(null);
        setName(null);
        setToken(null);
        setUserRole(null);
        setError(pendingAuthError);
      }
      if (eventId === authEventId) {
        setLoading(false);
      }
    });

    return () => {
      authEventId += 1;
      unsubscribe();
    };
  }, [fetchUserProfile]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      user,
      name,
      token,
      loading,
      userRole,
      error,
      logout,
    }),
    [user, name, token, loading, userRole, error, logout]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
