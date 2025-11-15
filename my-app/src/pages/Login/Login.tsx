// src/components/Login.tsx

import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { AuthError } from "../../types/user-types";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import { InputAdornment, TextField, CircularProgress } from "@mui/material";
import FormControl from "@mui/material/FormControl";
import Input from "@mui/material/Input";
import InputLabel from "@mui/material/InputLabel";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { auth } from "../../auth/firebaseConfig"; // Use the initialized auth from firebaseConfig.js
import styles from "./Login.module.css";
import foodForAllDCLogin from "../../assets/food-for-all-dc-login.png";
import foodForAllDCLogo from "../../assets/food-for-all-dc-logo.jpg";

function Login() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<AuthError | null>(null);
  const [resetPasswordMessage, setResetPasswordMessage] = useState("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Handle Enter key press
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin();
    }
  };

  // Set initial focus
  useEffect(() => {
    const emailInput = document.getElementById("standard-adornment-email");
    if (emailInput) {
      emailInput.focus();
    }
  }, []);

  //Route Protection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (user) {
        navigate("/clients");
      }
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [navigate]);

  // Helper to map Firebase login errors to AuthError
  const mapLoginError = (error: any): AuthError => {
    if (!error || !error.code) {
      return { code: "auth/unknown", message: "An error occurred during login. Please try again." };
    }
    switch (error.code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return { code: error.code, message: "Invalid email or password." };
      case "auth/missing-fields":
        return { code: error.code, message: "Please enter both email and password." };
      default:
        return { code: error.code, message: "An error occurred during login. Please try again." };
    }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError(mapLoginError({ code: "auth/missing-fields" }));
      return;
    }
    setIsLoading(true);
    setLoginError(null);
    setResetPasswordMessage("");
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      navigate("/clients");
    } catch (error: any) {
      console.error("Login Error:", error);
      setLoginError(mapLoginError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to map Firebase password reset errors to message
  const mapPasswordResetError = (error: any): string => {
    if (!error || !error.code) {
      return "An error occurred while sending the password reset email. Please try again.";
    }
    switch (error.code) {
      case "auth/user-not-found":
        return "No account found with that email address.";
      default:
        return "An error occurred while sending the password reset email. Please try again.";
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setResetPasswordMessage("Please enter your email address.");
      return;
    }
    try {
      setIsLoading(true);
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setResetPasswordMessage("If you have an account with us, you should get an email soon!");
      setForgotPasswordEmail("");
      setOpenDialog(false);
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      setResetPasswordMessage(mapPasswordResetError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDialogOpen = () => {
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setResetPasswordMessage("");
  };

  return (
    <div className={styles.outerContainer}>
      <div className={styles.imageContainer}>
        <img src={foodForAllDCLogin} alt="Food for All DC" />
      </div>
      <div className={styles.container}>
        <div>
          <img className={styles.logoImage} src={foodForAllDCLogo} alt="Food for All DC" />
        </div>
        <div className={styles.formContainer}>
          <h1 className={styles.heading}>Welcome!</h1>
          <p className={styles.subheading}>Please enter your details</p>

          <p className={styles.label}>Admin Login</p>

          <TextField
            label="Email"
            variant="outlined"
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            fullWidth
            aria-label="Email Address"
            className={styles.inputField}
            autoComplete="email"
            margin="normal"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <TextField
              label="Password"
              variant="outlined"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              fullWidth
              aria-label="Password"
              className={styles.inputField}
              autoComplete="current-password"
              margin="normal"
            />

            <div className={styles.forgotPasswordWrapper}>
              <p className={styles.forgotPasswordButton} onClick={handleDialogOpen}>
                Forgot password?
              </p>
            </div>

            {loginError && (
              <p className={styles.error} role="alert">
                {loginError.message}
              </p>
            )}
            {resetPasswordMessage && <p className={styles.resetMessage}>{resetPasswordMessage}</p>}

            <Button
              variant="contained"
              color="primary"
              type="submit"
              fullWidth
              disabled={isLoading}
              aria-label="Sign in"
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isLoading ? "Signing in..." : "Login"}
            </Button>
          </form>
        </div>
      </div>

      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        aria-labelledby="reset-password-dialog-title"
        PaperProps={{
          component: "form",
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            handleForgotPassword();
          },
          style: { borderRadius: "8px" },
        }}
      >
        <DialogTitle id="reset-password-dialog-title">Reset Password</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To reset your password, please enter your email address here. We will send a password
            reset link to your email.
          </DialogContentText>
          <TextField
            autoFocus
            required
            margin="dense"
            id="forgotPasswordEmail"
            name="email"
            label="Email Address"
            type="email"
            fullWidth
            variant="standard"
            value={forgotPasswordEmail}
            onChange={(e) => setForgotPasswordEmail(e.target.value)}
            autoComplete="email"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} style={{ borderRadius: "var(--border-radius-xl)" }}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            style={{ borderRadius: "var(--border-radius-xl)" }}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isLoading ? "Sending..." : "Send Email"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Login;
