// src/components/Login.tsx

import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import { InputAdornment, TextField } from "@mui/material";
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
  const [loginError, setLoginError] = useState("");
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
        navigate("/deliveries");
      }
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [navigate]);
  
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter both email and password");
      return;
    }
    
    try {
      setIsLoading(true);
      // Authenticate the user
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;

      // Successful login, navigate to calendar
      setLoginError("");
      navigate("/deliveries");

      // Clear input fields
      setLoginEmail("");
      setLoginPassword("");
    } catch (error: any) {
      console.error("Login error:", error.message);
      let errorMessage = "Login failed. Please check your credentials.";
      
      // Handle specific Firebase error codes
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errorMessage = "Invalid email or password";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed login attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection.";
      }
      
      setLoginError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setResetPasswordMessage("Please enter your email address");
      return;
    }
    
    try {
      setIsLoading(true);
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setResetPasswordMessage(
        "If you have an email account with us, you should get an email soon!"
      );
      setForgotPasswordEmail(""); // Clear the forgot password input field
      setOpenDialog(false); // Close the dialog after sending the email
    } catch (error: any) {
      console.error("Error sending password reset email:", error.message);
      setResetPasswordMessage("Error: " + error.message);
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

          <FormControl sx={{ m: 1, width: "100%", margin: "2%" }} variant="standard">
            <InputLabel htmlFor="standard-adornment-email">Email</InputLabel>
            <Input
              id="standard-adornment-email"
              type={"email"}
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              fullWidth
              required
              aria-label="Email Address"
              className={styles.inputField}
              autoComplete="email"
            />
          </FormControl>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <FormControl sx={{ m: 1, width: "100%", margin: "2%" }} variant="standard">
              <InputLabel htmlFor="standard-adornment-password">Password</InputLabel>
              <Input
                id="standard-adornment-password"
                type={"password"}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                fullWidth
                required
                aria-label="Password"
                className={styles.inputField}
                autoComplete="current-password"
              />
            </FormControl>
            
            <div className={styles.forgotPasswordWrapper}>
              <p className={styles.forgotPasswordButton} onClick={handleDialogOpen}>
                Forgot password?
              </p>
            </div>
            
            {loginError && <p className={styles.error} role="alert">{loginError}</p>}
            {resetPasswordMessage && <p className={styles.resetMessage}>{resetPasswordMessage}</p>}
            
            <Button 
              variant="contained" 
              color="primary" 
              type="submit" 
              fullWidth
              disabled={isLoading}
              aria-label="Sign in"
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
          style: { borderRadius: '8px' }
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
          <Button 
            onClick={handleDialogClose}
            style={{ borderRadius: 'var(--border-radius-xl)' }}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            disabled={isLoading}
            style={{ borderRadius: 'var(--border-radius-xl)' }}
          >
            {isLoading ? "Sending..." : "Send Email"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Login;
