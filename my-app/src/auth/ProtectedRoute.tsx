import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { UserType } from '../types'; // Assuming UserType is in src/types
import LoadingIndicator from '../components/LoadingIndicator/LoadingIndicator'; // Import LoadingIndicator
import { Box } from '@mui/material'; // Import Box for styling

interface ProtectedRouteProps {
  allowedRoles: UserType[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { userRole, loading } = useAuth();

  if (loading) {
    // Use the shared LoadingIndicator, centered in the viewport
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' // Adjust height as needed, maybe less than 100vh if inside other layout
        }}
      >
        <LoadingIndicator size={60} /> 
      </Box>
    );
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    // Redirect them to the home page, login page, or an "Access Denied" page
    // For simplicity, redirecting to home ('/') or login might be best initially.
    // If you have a specific access denied page, use that path.
    console.warn(`Access denied for role: ${userRole}. Required roles: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />; 
  }

  // If the role is allowed, render the child route component
  return <Outlet />;
};

export default ProtectedRoute; 