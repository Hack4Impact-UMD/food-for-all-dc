import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { auth } from "../../auth/firebaseConfig";
import styles from "./Login.module.css";
import foodForAllDCLogin from "../../assets/food-for-all-dc-login.png";
import foodForAllDCLogo from "../../assets/food-for-all-dc-logo.jpg";

const MIN_PASSWORD_LENGTH = 8;

type Stage = "verifying" | "form" | "success" | "invalid";

// Maps Firebase action-code errors to messages that make sense to a user
// who just clicked a link in their email.
const mapActionCodeError = (error: any): string => {
  switch (error?.code) {
    case "auth/expired-action-code":
      return "This password reset link has expired. Please request a new one.";
    case "auth/invalid-action-code":
      return "This password reset link is no longer valid. It may have already been used. Please request a new one.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact an administrator.";
    case "auth/user-not-found":
      return "No account was found for this reset link. Please contact an administrator.";
    case "auth/weak-password":
      return "That password is too weak. Please choose a stronger one.";
    default:
      return "Something went wrong. Please request a new password reset email and try again.";
  }
};

const AuthActionPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  const [stage, setStage] = useState<Stage>("verifying");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successHeading, setSuccessHeading] = useState("Password Updated");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Validate the emailed action code before showing any form, so an expired or
  // already-used link fails up front instead of after the user types a password.
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!oobCode) {
        if (!cancelled) {
          setError("This link is missing information. Please request a new password reset email.");
          setStage("invalid");
        }
        return;
      }

      try {
        if (mode === "resetPassword") {
          const email = await verifyPasswordResetCode(auth, oobCode);
          if (cancelled) return;
          setAccountEmail(email);
          setStage("form");
        } else if (mode === "verifyEmail") {
          await applyActionCode(auth, oobCode);
          if (cancelled) return;
          setSuccessHeading("Email Verified");
          setSuccessMessage("Your email address has been verified. You can sign in now.");
          setStage("success");
        } else if (mode === "recoverEmail") {
          await applyActionCode(auth, oobCode);
          if (cancelled) return;
          setSuccessHeading("Email Restored");
          setSuccessMessage("Your email address has been restored. You can sign in now.");
          setStage("success");
        } else {
          setError("This link isn't supported. Please request a new password reset email.");
          setStage("invalid");
        }
      } catch (verifyError: any) {
        if (cancelled) return;
        setError(mapActionCodeError(verifyError));
        setStage("invalid");
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!password || !confirmPassword) {
        setError("Please enter and confirm your new password.");
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!oobCode) {
        setError("This link is missing information. Please request a new password reset email.");
        setStage("invalid");
        return;
      }

      setIsSubmitting(true);
      try {
        await confirmPasswordReset(auth, oobCode, password);
        setSuccessHeading("Password Updated");
        setSuccessMessage(
          accountEmail
            ? `Your password for ${accountEmail} has been changed. You can sign in with it now.`
            : "Your password has been changed. You can sign in with it now."
        );
        setPassword("");
        setConfirmPassword("");
        setStage("success");
      } catch (resetError: any) {
        console.error("Password reset error:", resetError);
        setError(mapActionCodeError(resetError));
        if (
          resetError?.code === "auth/expired-action-code" ||
          resetError?.code === "auth/invalid-action-code"
        ) {
          setStage("invalid");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [accountEmail, confirmPassword, oobCode, password]
  );

  const goToLogin = () => navigate("/");

  const renderContent = () => {
    if (stage === "verifying") {
      return (
        <div className={styles.statusBlock}>
          <CircularProgress size={40} style={{ color: "var(--color-primary)" }} />
          <p className={styles.subheading}>Checking your link...</p>
        </div>
      );
    }

    if (stage === "invalid") {
      return (
        <>
          <ErrorOutlineIcon className={styles.statusIconError} />
          <h1 className={styles.heading}>Link Not Valid</h1>
          <p className={styles.subheading}>{error}</p>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={() => navigate("/forgot-password")}
          >
            Request New Link
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={goToLogin}
            className={styles.secondaryButton}
          >
            Back to Login
          </Button>
        </>
      );
    }

    if (stage === "success") {
      return (
        <>
          <CheckCircleOutlineIcon className={styles.statusIconSuccess} />
          <h1 className={styles.heading}>{successHeading}</h1>
          <p className={styles.subheading}>{successMessage}</p>
          <Button variant="contained" color="primary" fullWidth onClick={goToLogin}>
            Back to Login
          </Button>
        </>
      );
    }

    return (
      <>
        <h1 className={styles.heading}>Reset Password</h1>
        <p className={styles.subheading}>
          {accountEmail
            ? `Choose a new password for ${accountEmail}`
            : "Choose a new password for your account"}
        </p>
        <form onSubmit={handleSubmit}>
          <TextField
            label="New Password"
            variant="outlined"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            autoFocus
            disabled={isSubmitting}
            autoComplete="new-password"
            margin="normal"
            className={styles.inputField}
            helperText={`Must be at least ${MIN_PASSWORD_LENGTH} characters.`}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((prev) => !prev)}
                    edge="end"
                    disabled={isSubmitting}
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Confirm New Password"
            variant="outlined"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            required
            disabled={isSubmitting}
            autoComplete="new-password"
            margin="normal"
            className={styles.inputField}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    edge="end"
                    disabled={isSubmitting}
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isSubmitting ? "Saving..." : "Save New Password"}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={goToLogin}
            disabled={isSubmitting}
            className={styles.secondaryButton}
          >
            Back to Login
          </Button>
        </form>
      </>
    );
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
        <div className={styles.formContainer}>{renderContent()}</div>
      </div>
    </div>
  );
};

export default AuthActionPage;
