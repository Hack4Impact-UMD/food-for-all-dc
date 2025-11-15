import { useEffect, useRef, useState, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../auth/firebaseConfig";
import { Button, Dialog, DialogContent, DialogTitle, Typography, Box } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

//AutoLogout Types
enum AutoLogoutType {
  NONE,
  WARNING,
  LOGOUT,
}

const AutoLogout = () => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [type, setType] = useState<AutoLogoutType>(AutoLogoutType.NONE);

  const ONE_HOUR = 60 * 60 * 1000;
  const FIFTY_NINE_AND_A_HALF_MINUTES = 59.5 * 60 * 1000;

  //dynamic dialog settings
  const isLogout = type === AutoLogoutType.LOGOUT;
  const color = isLogout ? "error" : "warning";
  const borderColor = isLogout ? "#d32f2f" : "#ed6c02";
  const Icon = isLogout ? ErrorOutlineIcon : WarningAmberIcon;
  const title = isLogout ? "Session Expired" : "Inactivity Warning";
  const message = isLogout
    ? "You have been logged out due to inactivity."
    : "You will be logged out in 30 seconds due to inactivity.";

  // Start or reset inactivity timer
  const startTimer = useCallback(() => {
    clearTimeout(timeoutRef.current!);
    clearTimeout(warningRef.current!);

    //30 second warning
    warningRef.current = setTimeout(() => {
      setType(AutoLogoutType.WARNING);
    }, FIFTY_NINE_AND_A_HALF_MINUTES);

    //logout after 1 hour
    timeoutRef.current = setTimeout(() => {
      signOut(auth);
      setType(AutoLogoutType.LOGOUT);
    }, ONE_HOUR);
  }, []);

  const handleActivity = useCallback(() => {
    if (auth.currentUser) {
      setType(AutoLogoutType.NONE);

      // Debounce the timer reset to prevent excessive calls
      clearTimeout(debounceRef.current!);
      debounceRef.current = setTimeout(() => {
        startTimer();
      }, 500); // 500ms debounce
    }
  }, [startTimer]);

  useEffect(() => {
    const activityEvents = ["keydown", "click", "scroll", "touchstart"];

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      //cleanup if user logs out
      if (!user) {
        clearTimeout(timeoutRef.current!);
        clearTimeout(warningRef.current!);
        activityEvents.forEach((event) =>
          document.removeEventListener(event, handleActivity, true)
        );
        return;
      }

      //start timers on user login
      activityEvents.forEach((event) => document.addEventListener(event, handleActivity, true));
      startTimer();
    });

    //more cleanup stuff
    return () => {
      unsubscribe();
      activityEvents.forEach((event) => document.removeEventListener(event, handleActivity, true));
      clearTimeout(timeoutRef.current!);
      clearTimeout(warningRef.current!);
      clearTimeout(debounceRef.current!);
    };
  }, [handleActivity, startTimer]);

  return (
    <Dialog
      open={type !== AutoLogoutType.NONE}
      sx={{
        "& .MuiDialog-container": {
          alignItems: "flex-start",
          justifyContent: "center",
          mt: 5,
        },
      }}
      slotProps={{
        paper: {
          sx: {
            borderLeft: `6px solid ${borderColor}`,
            padding: 2,
            maxWidth: "400px",
          },
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Icon color={color} />
          <Typography variant="h6" color={color}>
            {title}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {message}
        </Typography>
        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            color={color}
            onClick={() => {
              if (isLogout) {
                setType(AutoLogoutType.NONE);
              } else {
                handleActivity();
              }
            }}
          >
            {isLogout ? "Okay" : "Stay Logged In"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AutoLogout;
