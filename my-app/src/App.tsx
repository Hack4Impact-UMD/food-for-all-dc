import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import ForgotPasswordPage from "./pages/Login/forgot-passsowrd"; // Assuming this is the component for forgot password
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./components/Calendar/CalendarPage";
import Profile from "./pages/Profile/Profile";
import Spreadsheet from "./components/Spreadsheet/Spreadsheet";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/profile"
          element={<Profile uid={"nlzNo7AnlUXx5OiCQ0Vn"} />}
        />
        <Route path="/spreadsheet" element={<Spreadsheet />} />
      </Routes>
    </Router>
  );
}

export default App;
