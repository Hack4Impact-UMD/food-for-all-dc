import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface PreloaderProps {
  message?: string;
  size?: number;
  showMessage?: boolean;
}

const Preloader: React.FC<PreloaderProps> = ({ 
  message = "Loading...", 
  size = 60, 
  showMessage = false 
}) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: 2
      }}
    >
      <CircularProgress 
        size={size} 
        sx={{ 
          color: 'var(--color-primary)'
        }} 
      />
      {showMessage && (
        <Typography 
          variant="body1" 
          sx={{ 
            color: 'var(--color-text-medium-alt)',
            fontWeight: 500
          }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default Preloader;
