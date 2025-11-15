import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../auth/firebaseConfig";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import styles from "./Login.module.css";

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

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!email) {
      setMessage("Please enter your email address.");
      return;
    }
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("If you have an account with us, you should get an email soon!");
      setEmail("");
    } catch (error: any) {
      setMessage(mapPasswordResetError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.outerContainer}>
      <div className={styles.container}>
        <div className={styles.formContainer}>
          <h1 className={styles.heading}>Reset Password</h1>
          <p className={styles.subheading}>Enter your email to receive a password reset link.</p>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Email Address"
              type="email"
              className="forgot-password-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoComplete="email"
              margin="normal"
            />
            {message && <p className={styles.resetMessage}>{message}</p>}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              fullWidth
              style={{ marginTop: "16px" }}
            >
              {isLoading ? "Sending..." : "Send Reset Email"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
