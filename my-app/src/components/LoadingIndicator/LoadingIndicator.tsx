import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Loading indicator component with consistent styling and optional text
 * 
 * @example
 * // Basic loading indicator
 * <LoadingIndicator />
 * 
 * // Loading with text
 * <LoadingIndicator text="Loading data..." />
 * 
 * // Small inline loading
 * <LoadingIndicator size="small" text="Saving..." />
 */
interface LoadingIndicatorProps {
  /** Size of the loading indicator */
  size?: 'small' | 'medium' | 'large' | number;
  /** Optional text to display below the spinner */
  text?: string;
  /** Custom minimum height for the container */
  minHeight?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ 
  size = 'medium', 
  text,
  minHeight = '150px' 
}) => {
  // Convert size to number
  const getSize = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'small': return 24;
      case 'medium': return 40;
      case 'large': return 60;
      default: return 40;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        minHeight,
        gap: 2,
      }}
    >
      <CircularProgress 
        size={getSize()} 
        sx={{ color: '#2E5B4C' }} 
      />
      {text && (
        <Typography 
          variant="body2" 
          sx={{ 
            color: '#666',
            textAlign: 'center',
            fontSize: size === 'small' ? '0.875rem' : '1rem'
          }}
        >
          {text}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingIndicator; 