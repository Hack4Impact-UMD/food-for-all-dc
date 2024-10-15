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
import ClientForm from "./components/ClientForm/ClientForm";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* FOR TESTING! access client form with option uid */}
        <Route path="/client-form/:uid?" element={<ClientFormWrapper />} />
      </Routes>
    </Router>
  );
}

const ClientFormWrapper: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  return <ClientForm uid={uid} />;
};

export default App;
