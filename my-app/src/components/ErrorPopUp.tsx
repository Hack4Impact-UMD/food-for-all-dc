import { useEffect, useState } from "react";
import styles from "./PopUp.module.css";
import { Box, Typography, Alert, AlertTitle, IconButton } from "@mui/material";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';

interface ErrorPopUpProps {
  message: string;
  duration?: number;
  title?: string;
}

/**
 * A more prominent error popup component for important errors
 * Shows as a modal dialog in the center of the screen
 */
const ErrorPopUp: React.FC<ErrorPopUpProps> = ({ 
  message, 
  duration,  // Optional - if provided, will auto-close after duration
  title = "Error" 
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);

      // Clean up the timer
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Box className={styles.errorPopupOverlay} onClick={handleClose}>
      <Alert 
        severity="error"
        variant="filled"
        icon={<ErrorOutlineIcon fontSize="large" />}
        className={styles.errorPopupContainer}
        sx={{
          // Enhanced styles to make the error more prominent
          boxShadow: '0 4px 20px rgba(255, 0, 0, 0.3), 0 0 40px rgba(255, 0, 0, 0.15)', 
          border: '2px solid #ff0000',
          '& .MuiAlert-message': {
            fontSize: '1.1rem'
          },
          '& .MuiAlert-icon': {
            fontSize: '2rem'
          }
        }}
        // Stop propagation to prevent closing when clicking inside the alert
        onClick={(e) => e.stopPropagation()}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={handleClose}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
      >
        <AlertTitle sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{title}</AlertTitle>
        <Typography sx={{ whiteSpace: 'pre-line' }}>{message}</Typography>
      </Alert>
    </Box>
  );
};

export default ErrorPopUp;
