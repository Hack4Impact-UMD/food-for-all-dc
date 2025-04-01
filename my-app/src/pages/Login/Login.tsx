// src/components/Login.tsx

import React, { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import { InputAdornment, TextField} from '@mui/material';
import FormControl from '@mui/material/FormControl';
import Input from '@mui/material/Input';
import InputLabel from '@mui/material/InputLabel';
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { auth } from "../../auth/firebaseConfig"; // Use the initialized auth from firebaseConfig.js
import "./Login.css";
import foodForAllDCLogin from "../../assets/food-for-all-dc-login.png";
import foodForAllDCLogo from "../../assets/food-for-all-dc-logo.jpg";
import { onAuthStateChanged } from "firebase/auth";



function Login() {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [resetPasswordMessage, setResetPasswordMessage] = useState("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

  const navigate = useNavigate();

  //Route Protection
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user:any) => {
      if (user) {
        navigate("/calendar");
      } 
    });
  
    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [navigate]);
  const handleLogin = async () => {
    try {
      // Authenticate the user
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;
      
      
      // Successful login, navigate to calendar
      setLoginError("");
      navigate("/calendar");

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
      <div className="login-image-container">
        <img src={foodForAllDCLogin} alt="Food for All DC" />
      </div>
      <div className="login-container">
        <div className="image-container">
          <img className = "logo-image" src={foodForAllDCLogo} alt="Food for All DC" />
        </div>
        <div className="login-form-container">
          <h1 className="login-heading">Welcome!</h1>
          <p className="login-subheading">Please enter your details</p>

          <p className="login-label">Admin Login</p>
          
          <FormControl sx={{ m: 1, width: '100%', margin: '2%' }} 
          variant="standard">
          <InputLabel htmlFor="standard-adornment-email">Email</InputLabel>
          <Input
            id="standard-adornment-email"
            type={'email'}
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            fullWidth
            className="login-input-field"
          />
          </FormControl>
            
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
        <InputLabel htmlFor="standard-adornment-password">Password</InputLabel>
        <Input
            id="standard-adornment-password"
            type={'password'}
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            fullWidth
            className="login-input-field"
            endAdornment={
              <InputAdornment position="end">
              <span className="forgot-password-container">
                <p className="forgot-password-button" onClick={handleDialogOpen}>
                  Forgot Password?
                </p>
                {resetPasswordMessage && (
                  <p className="reset-password-message">{resetPasswordMessage}</p>
                )}
              </span>
              </InputAdornment> 
            }
          />
          {loginError && <p className="login-error">{loginError}</p>}
          <Button variant="contained" color="primary" type="submit" fullWidth>
            Login
          </Button>
          </form>

          
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

