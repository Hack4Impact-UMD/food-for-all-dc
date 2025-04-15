import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type User,
  type IdTokenResult,
} from "@firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
import { app } from "./firebaseConfig";

interface Props {
  children: JSX.Element;
}

interface AuthContextType {
  user: User | null;
  token: IdTokenResult | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// Create a default context value
const defaultAuthContext: AuthContextType = {
  user: null,
  token: null,
  loading: true,
  // This is a placeholder implementation that will be overridden by the actual implementation in AuthProvider
  logout: async () => { /* Default implementation, will be replaced */ },
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider = ({ children }: Props): React.ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<IdTokenResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const logout = async () => {
    const auth = getAuth(app);
    try {
      await signOut(auth);
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (newUser) => {
      setUser(newUser);
      if (newUser) {
        newUser
          .getIdTokenResult()
          .then(setToken)
          .catch(() => setToken(null));
      } else {
        setToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, logout }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
