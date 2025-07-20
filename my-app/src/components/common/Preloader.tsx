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
        backgroundColor: '#f5f5f5',
        gap: 2
      }}
    >
      <CircularProgress 
        size={size} 
        sx={{ 
          color: '#257E68' // Food for All DC primary color
        }} 
      />
      {showMessage && (
        <Typography 
          variant="body1" 
          sx={{ 
            color: '#666',
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
