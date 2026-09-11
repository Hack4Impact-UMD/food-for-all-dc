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
import { UserType, parseUserRole } from "../types";

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
const AUTH_ATTEMPT_TIMEOUT = 5000;
const PROFILE_LOOKUP_ATTEMPTS = 3;
const PROFILE_RETRY_BASE_DELAY = 300;

/** The cache is module state and outlives any single provider, so tests must clear it. */
export const resetUserRoleCache = () => userRoleCache.clear();

/** Error carrying a stable `code`, matching the shape the auth listener reports. */
const codedError = (code: string, message: string): Error & { code: string } =>
  Object.assign(new Error(message), { code });

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Retrying these can never succeed, and reporting them as a connection problem
// sends the user chasing their network instead of an administrator.
const NON_RETRYABLE_CODES = new Set([
  "permission-denied",
  "unauthenticated",
  "auth/user-disabled",
  "auth/user-token-expired",
  "auth/invalid-user-token",
]);

const errorCode = (error: unknown): string => (error as { code?: string })?.code ?? "";

const isRetryable = (error: unknown): boolean => !NON_RETRYABLE_CODES.has(errorCode(error));

/** Rejects if `operation` has not settled within the per-attempt budget. */
const withTimeout = async <T,>(operation: () => Promise<T>): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(codedError("auth/timeout", "Signing in took too long. Please try again.")),
          AUTH_ATTEMPT_TIMEOUT
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutHandle);
  }
};

/**
 * Runs `operation` with a per-attempt timeout, retrying transient failures. The
 * timeout is per attempt so the whole retry budget always fits inside it, and
 * `isCancelled` stops the loop once a newer auth event has superseded this one.
 */
const withRetries = async <T,>(
  operation: () => Promise<T>,
  isCancelled: () => boolean = () => false
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= PROFILE_LOOKUP_ATTEMPTS; attempt++) {
    if (isCancelled()) {
      throw codedError("auth/superseded", "This sign-in was replaced by a newer one.");
    }
    try {
      return await withTimeout(operation);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === PROFILE_LOOKUP_ATTEMPTS) {
        break;
      }
      await delay(PROFILE_RETRY_BASE_DELAY * attempt);
    }
  }
  throw lastError;
};

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
  return { role: parseUserRole(userData.role), name: userData.name ?? null };
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
    async (
      uid: string,
      isCancelled: () => boolean
    ): Promise<{ role: UserType | null; name: string | null }> => {
      // Check cache first with expiration
      const cachedEntry = userRoleCache.get(uid);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
        return { role: cachedEntry.role, name: cachedEntry.name };
      }

      // A lookup that never completed is not the same as an account with no role,
      // so retry transient Firestore failures before giving up.
      try {
        const profile = await withRetries(() => readUserProfile(uid), isCancelled);
        // Only a completed lookup is cacheable.
        userRoleCache.set(uid, { ...profile, timestamp: Date.now() });
        return profile;
      } catch (error) {
        if (errorCode(error) === "auth/superseded") {
          throw error;
        }
        console.error("Error fetching user role after retries:", error);
        throw codedError(
          "auth/profile-unavailable",
          isRetryable(error)
            ? "We couldn't verify your account right now. Check your connection and try again."
            : "We couldn't read your account profile. Please contact an administrator."
        );
      }
    },
    []
  );

  useEffect(() => {
    const auth = getFirebaseAuth();
    let authEventId = 0;
    const unsubscribe = onAuthStateChanged(auth, async (newUser: any) => {
      const eventId = ++authEventId;
      const isSuperseded = () => eventId !== authEventId;
      if (newUser) {
        pendingAuthErrorRef.current = null;
        setUser(null);
        setName(null);
        setToken(null);
        setUserRole(null);
        // A fresh attempt starts clean, so an earlier rejection is not left
        // standing over new input on the login page.
        setError(null);
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
          // The token refresh is as network-bound as the profile read, so it gets
          // the same retries instead of ejecting a valid session on one blip.
          const [tokenResult, { role, name: profileName }] = await Promise.all([
            withRetries<IdTokenResult>(() => newUser.getIdTokenResult(), isSuperseded),
            fetchUserProfile(newUser.uid, isSuperseded),
          ]);
          if (isSuperseded()) {
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
          setName(profileName);
          setError(null);
        } catch (err: any) {
          if (isSuperseded()) {
            return;
          }
          let authError: AuthError = {
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
            // The session is still live, so report that rather than a clean
            // rejection the user has no way to act on.
            authError = {
              code: "auth/signout-failed",
              message: "We couldn't end this session. Please reload the page and try again.",
            };
            pendingAuthErrorRef.current = authError;
          }
          if (isSuperseded()) {
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
        // Only ever carry a reason in. signOut() notifies this listener on a
        // deferred microtask, so the event that ejected the session may already
        // have applied its own reason, and clearing it would hide why.
        if (pendingAuthError) {
          setError(pendingAuthError);
        }
      }
      if (!isSuperseded()) {
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
