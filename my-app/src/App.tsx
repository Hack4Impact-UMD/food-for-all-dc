import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import ForgotPasswordPage from "./pages/Login/forgot-passsowrd"; // Assuming this is the component for forgot password
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard";
import Spreadsheet from "./components/Spreadsheet/Spreadsheet";
import CalendarPage from "./components/Calendar/CalendarPage";
import UserProfile from "./components/UserProfile/UserProfile";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Spreadsheet />} />
        <Route path="/user/:uid" element={<UserProfile />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
