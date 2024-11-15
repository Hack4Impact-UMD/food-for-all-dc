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
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile/:uid" element={<ProfileRouter />} />
        <Route
          path="/profile"
          element={<Profile uid={"kBTldkURU4udo9kP9Rwt"} />}
        />
        <Route path="/spreadsheet" element={<Spreadsheet />} />
      </Routes>
    </Router>
  );
}

export default App;
