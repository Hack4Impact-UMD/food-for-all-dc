// src/components/Login.tsx

import React, { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { auth } from "../../auth/firebaseConfig"; // Use the initialized auth from firebaseConfig.js
import "./Login.css";

function Login() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [resetPasswordMessage, setResetPasswordMessage] = useState("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      // Authenticate the user
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;

      // Successful login, navigate to dashboard
      setLoginError("");
      navigate("/dashboard");

      // Clear input fields
      setLoginEmail("");
      setLoginPassword("");
    } catch (error: any) {
      console.error("Login error:", error.message);
      setLoginError("Login error: " + error.message);
    }
  };

  const handleForgotPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setResetPasswordMessage("If you have an email account with us, you should get an email soon! ");
      setForgotPasswordEmail(""); // Clear the forgot password input field
      setOpenDialog(false); // Close the dialog after sending the email
    } catch (error: any) {
      console.error("Error sending password reset email:", error.message);
      setResetPasswordMessage("Error: " + error.message);
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
    <div className="login-outer-container">
      <div className="login-container">
        <div className="image-container">
          <div className="login-image" />
        </div>
        <div className="login-form-container">
          <h1 className="login-heading">Welcome!</h1>
          <p className="login-subheading">Please enter your details</p>

          <p className="login-label">Admin Login</p>


          <TextField
            type="email"
            label="Email"
            variant="outlined"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            fullWidth
            className="login-input-field"
          />
          <TextField
            type="password"
            label="Password"
            variant="outlined"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            fullWidth
            className="login-input-field"
          />
          {loginError && <p className="login-error">{loginError}</p>}
          <Button variant="contained" color="primary" onClick={handleLogin} fullWidth>
            Login
          </Button>

          <div className="forgot-password-container">
            <p className="forgot-password-button" onClick={handleDialogOpen}>
              Forgot Password?
            </p>
            {resetPasswordMessage && (
              <p className="reset-password-message">{resetPasswordMessage}</p>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={openDialog}
        onClose={handleDialogClose}
        PaperProps={{
          component: "form",
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            handleForgotPassword();
          },
        }}
      >
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To reset your password, please enter your email address here. We will send a password reset link to your email.
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button type="submit">Send Email</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Login;

