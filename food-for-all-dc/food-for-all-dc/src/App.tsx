import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import ForgotPasswordPage from './Login/forgot-password'; // Assuming this is the component for forgot password
import Dashboard from './Dashboard';
import Login from './Login/login';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
