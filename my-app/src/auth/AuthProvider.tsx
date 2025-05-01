import {
  getAuth,
  onAuthStateChanged,
  signOut,
  type User,
  type IdTokenResult,
} from "@firebase/auth";
import React, { createContext, useContext, useEffect, useState } from "react";
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
  // This is a placeholder implementation that will be overridden by the actual implementation in AuthProvider
  logout: async () => { /* Default implementation, will be replaced */ },
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider = ({ children }: Props): React.ReactElement => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<IdTokenResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserType | null>(null);

  const logout = async () => {
    const auth = getAuth(app);
    try {
      await signOut(auth);
      setUser(null);
      setToken(null);
      setUserRole(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (newUser) => {
      setUser(newUser);

      if (newUser) {
        try {
          const tokenResult = await newUser.getIdTokenResult();
          setToken(tokenResult);

          const userDocRef = doc(db, "users", newUser.uid);
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
            setUserRole(roleEnum);
          } else {
            console.warn(`User document not found in Firestore for UID: ${newUser.uid}`);
            setUserRole(null);
          }
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
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, userRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
