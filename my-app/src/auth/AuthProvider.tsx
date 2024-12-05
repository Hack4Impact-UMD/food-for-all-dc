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
  
  // The AuthContext that other components may subscribe to.
  const AuthContext = createContext<AuthContextType>(null!);
  
  export const AuthProvider = ({ children }: Props): React.ReactElement => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<IdTokenResult | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
  
    // Logout function to sign out the current user
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
  
    const providerProps = React.useMemo(() => {
      return { user, token, loading, logout };
    }, [user, token, loading]);
  
    useEffect(() => {
      const auth = getAuth(app);
  
      const unsubscribe = onAuthStateChanged(auth, (newUser) => {
        setUser(newUser);
        if (newUser != null) {
          newUser
            .getIdTokenResult()
            .then((newToken) => {
              setToken(newToken);
            })
            .catch(() => {
              setToken(null);
            });
        } else {
          setToken(null);
        }
        setLoading(false);
      });
    }, []);
  
    return (
      <AuthContext.Provider value={providerProps}>
        {children}
      </AuthContext.Provider>
    );
  };
  
  export const useAuth = () => {
    return useContext(AuthContext);
  };
  