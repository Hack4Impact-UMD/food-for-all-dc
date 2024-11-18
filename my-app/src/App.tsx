import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
} from "react-router-dom";
import "./App.css";
import ForgotPasswordPage from "./pages/Login/forgot-passsowrd";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard";
import BasePage from './pages/Base/Base';
import CalendarPage from "./components/Calendar/CalendarPage";
import Profile from "./pages/Profile/Profile";
import Spreadsheet from "./components/Spreadsheet/Spreadsheet";

const ProfileRouter = () => {
  const { uid } = useParams() as { uid: string };
  return <Profile uid={uid} />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        
        {/* Protected or main routes wrapped with BasePage */}
        <Route
          path="/dashboard"
          element={
            <BasePage>
              <Dashboard />
            </BasePage>
          }
        />
        <Route
          path="/calendar"
          element={
            <BasePage>
              <CalendarPage />
            </BasePage>
          }
        />
        {/* Profile routes */}
        <Route
          path="/profile/:uid"
          element={
            <BasePage>
              <ProfileRouter />
            </BasePage>
          }
        />
        <Route
          path="/profile"
          element={
            <BasePage>
              <Profile uid="kBTldkURU4udo9kP9Rwt" />
            </BasePage>
          }
        />
        <Route
          path="/spreadsheet"
          element={
            <BasePage>
              <Spreadsheet />
            </BasePage>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;