import { UserType, canCreateUserType } from "../../types";
import "./CreateUsers.css";
import React, { useState, useEffect } from "react";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { FirebaseApp, FirebaseOptions, initializeApp, getApp } from "firebase/app";
import { firebaseConfig } from "../../auth/firebaseConfig";
import {
  createAdminUser,
  createManagerUser,
  createClientIntakeUser,
} from "../../backend/cloudFunctionsCalls";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import Alert from "@mui/material/Alert";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  getDocs,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  doc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import dataSources from '../../config/dataSources';
import { db } from "../../auth/firebaseConfig";
import Button from '../../components/common/Button';

let firebaseApp: FirebaseApp;
try {
  firebaseApp = initializeApp(firebaseConfig as FirebaseOptions);
} catch (error) {
  firebaseApp = getApp();
}

const CreateUsers: React.FC = () => {
  const authContext = useAuth();
  const [currentUserType, setCurrentUserType] = useState<UserType | null>(null);
  const [availableUserTypes, setAvailableUserTypes] = useState<UserType[] | undefined>();
  const [newUserType, setNewUserType] = useState<UserType>();
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [registrationError, setRegistrationError] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRetypePassword, setShowRetypePassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authContext?.loading) {
      const role = authContext?.token?.claims?.role as UserType;
      setCurrentUserType(role);
    }
  }, [authContext?.loading, authContext?.token?.claims?.role]);

  useEffect(() => {
    setCurrentUserType(UserType.Admin);
    const types = [UserType.Admin, UserType.Manager, UserType.ClientIntake];
    setAvailableUserTypes(types);
  }, []);

  useEffect(() => {
    if (registrationSuccess) {
      const timer = setTimeout(() => {
        setRegistrationSuccess(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [registrationSuccess]);

  // const getAvailableUserTypes = (role: UserType): UserType[] => {
  //   switch (role) {
  //     case UserType.Admin:

  //     case UserType.Manager:
  //       return [UserType.ClientIntake];
  //     default:
  //       return [];
  //   }
  // };

  const getDisplayName = (type: UserType): string => {
    switch (type) {
      case UserType.Admin:
        return "Admin";
      case UserType.Manager:
        return "Manager";
      case UserType.ClientIntake:
        return "Client Intake";
      default:
        return "";
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleRetypePasswordVisibility = () => setShowRetypePassword(!showRetypePassword);

  const resetForm = () => {
    setRegistrationEmail("");
    setRegistrationPassword("");
    setRetypePassword("");
    setNewUserName("");
    setShowPassword(false);
    setShowRetypePassword(false);
  };

  const handleRegister = async () => {
    setRegistrationError("");

    if (
      !newUserType ||
      !newUserName.trim() ||
      !registrationEmail.trim() ||
      !registrationPassword.trim()
    ) {
      setRegistrationError("All fields are required.");
      return;
    }

    if (registrationPassword !== retypePassword) {
      setRegistrationError("Passwords do not match.");
      return;
    }

    try {
      const auth = getAuth(firebaseApp);
      const currentUser = auth.currentUser;

      // Set up the auth state listener but we don't need to do anything in the callback
      // since we're just using it to unsubscribe later
      const unsubscribe = onAuthStateChanged(auth, () => {
        // This callback intentionally left empty as we only need the unsubscribe function
      });
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        registrationEmail,
        registrationPassword
      );

      await auth.updateCurrentUser(currentUser);
      const userId = userCredential.user.uid;

      // switch (newUserType) {
      //   case UserType.Admin:
      //     await createAdminUser(userId, registrationEmail, newUserName);
      //     break;
      //   case UserType.Manager:
      //     await createManagerUser(userId, registrationEmail, newUserName);
      //     break;
      //   case UserType.ClientIntake:
      //     await createClientIntakeUser(userId, registrationEmail, newUserName);
      //     break;
      // }

      const newUser = {
        name: newUserName,
        email: registrationEmail,
        password: registrationPassword,
        role: getDisplayName(newUserType),
      };
  await setDoc(doc(db, dataSources.firebase.usersCollection, userId), newUser);

      resetForm();
      setRegistrationSuccess(true);
      unsubscribe();
    } catch (error: any) {
      console.error("Registration error:", error); // Log the full error object
      const errorMessage =
        error.code === "functions/internal"
          ? "Internal server error. Please try again later."
          : error.message;
      setRegistrationError("Registration error: " + errorMessage);
      setRegistrationSuccess(false);
    }
  };

  return (
    <div className="user-container">
      <div className="user-form-container">
        {registrationSuccess && <Alert severity="success">User Successfully Created!</Alert>}
        {registrationError && <Alert severity="error">{registrationError}</Alert>}
        <h2>Create New User</h2>
        <div className="heading-text">Select new user type</div>

        <div className="userOptions">
          {availableUserTypes?.map((type) => (
            <label key={type} className="userOption">
              <input
                type="radio"
                name="userType"
                value={type}
                checked={newUserType === type}
                onChange={(e) => setNewUserType(e.target.value as UserType)}
              />
              <span>{getDisplayName(type)}</span>
            </label>
          ))}
        </div>

        <input
          type="text"
          placeholder="Name"
          value={newUserName}
          onChange={(e) => setNewUserName(e.target.value)}
          className="user-input-field"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={registrationEmail}
          onChange={(e) => setRegistrationEmail(e.target.value)}
          className="user-input-field"
          required
        />

        <div className="password-icon">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={registrationPassword}
            onChange={(e) => setRegistrationPassword(e.target.value)}
            className="user-input-field"
            required
          />
          <span className="visibility-icon" onClick={togglePasswordVisibility}>
            {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </span>
        </div>

        <div className="password-icon">
          <input
            type={showRetypePassword ? "text" : "password"}
            placeholder="Re-type Password"
            value={retypePassword}
            onChange={(e) => setRetypePassword(e.target.value)}
            className="user-input-field"
            required
          />
          <div className="visibility-icon" onClick={toggleRetypePasswordVisibility}>
            {showRetypePassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </div>
        </div>

        
        <Button variant="primary" onClick={handleRegister} fullWidth>
          Create User
        </Button>
      </div>
    </div>
  );
};

export default CreateUsers;
