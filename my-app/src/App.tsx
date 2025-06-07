import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import ForgotPasswordPage from "./pages/Login/forgot-password";

import Login from "./pages/Login/Login";
import CalendarPage from "./pages/Calendar/CalendarPage";
import Spreadsheet from "./components/Spreadsheet/Spreadsheet";
import UsersSpreadsheet from "./components/UsersSpreadsheet/UsersSpreadsheet";

import Profile from "./pages/Profile/Profile";
import BasePage from "./pages/Base/Base";
import DeliverySpreadsheet from "./pages/Delivery/DeliverySpreadsheet";

import { useAuth } from "./auth/AuthProvider";
import LoadingIndicator from "./components/LoadingIndicator/LoadingIndicator";
import { Box } from "@mui/material";
import ProtectedRoute from "./auth/ProtectedRoute";
import { UserType } from "./types";

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}
      >
        <LoadingIndicator size={60} /> 
      </Box>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Main app structure wrapped by BasePage */} 
        <Route path="/*" element={<BasePage />}>
          {/* Routes accessible to all authenticated users */}
          <Route path="clients" element={<Spreadsheet />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="profile/:clientId?" element={<Profile />} />
          <Route path="delivery" element={<DeliverySpreadsheet />} />
          {/* Routes with specific role requirements */}
          <Route element={<ProtectedRoute allowedRoles={[UserType.Admin, UserType.Manager]} />}>
            {/* Nested route for Delivery, accessible only via ProtectedRoute */}
            <Route path="users" element={<UsersSpreadsheet />} /> 
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
