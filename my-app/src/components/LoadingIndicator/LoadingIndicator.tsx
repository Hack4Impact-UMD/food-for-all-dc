import React from 'react';
import { Box, CircularProgress } from '@mui/material';

interface LoadingIndicatorProps {
  size?: number; // Optional size prop for the CircularProgress
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ size = 40 }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%', // Make it take full height of its container
        minHeight: '150px', // Ensure it has some minimum height
      }}
    >
      <CircularProgress size={size} sx={{ color: '#2E5B4C' }} />
    </Box>
  );
};

export default LoadingIndicator; 