import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import ForgotPasswordPage from "./pages/Login/forgot-password";

import Login from "./pages/Login/Login";
import CalendarPage from "./components/Calendar/CalendarPage";
import Spreadsheet from "./components/Spreadsheet/Spreadsheet";

import Profile from "./pages/Profile/Profile";
import BasePage from "./pages/Base/Base";
import CreateUsers from "./pages/CreateUsers/CreateUsers";
import DeliverySpreadsheet from "./pages/Delivery/DeliverySpreadsheet";
import TestCsvPage from "./pages/Delivery/TestCsvPage";

import { useAuth } from "./auth/AuthProvider";
import LoadingIndicator from "./components/LoadingIndicator/LoadingIndicator";
import { Box } from "@mui/material";

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
        {/* Testing Routes */}
        <Route path="/test-csv" element={<TestCsvPage />} />

        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected or main routes wrapped with BasePage */}
        <Route path="/*" element={<BasePage />}>
          <Route path="clients" element={<Spreadsheet />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="profile/:clientId?" element={<Profile />} />
          <Route path="delivery" element={<DeliverySpreadsheet />} />
          <Route path="create-users" element={<CreateUsers />} />
          <Route path="test-csv" element={<TestCsvPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
