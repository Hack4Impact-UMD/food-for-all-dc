import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";

// Keep login-related components as synchronous since they're needed immediately
import Login from "./pages/Login/Login";
import ForgotPasswordPage from "./pages/Login/forgot-password";

// Lazy load heavy components
const CalendarPage = React.lazy(() => import("./pages/Calendar/CalendarPage"));
const Spreadsheet = React.lazy(() => import("./components/Spreadsheet/Spreadsheet"));
const UsersSpreadsheet = React.lazy(() => import("./components/UsersSpreadsheet/UsersSpreadsheet"));
const Profile = React.lazy(() => import("./pages/Profile/Profile"));
const BasePage = React.lazy(() => import("./pages/Base/Base"));
const DeliverySpreadsheet = React.lazy(() => import("./pages/Delivery/DeliverySpreadsheet"));

import { useAuth } from "./auth/AuthProvider";
import LoadingIndicator from "./components/LoadingIndicator/LoadingIndicator";
import Preloader from "./components/common/Preloader";
import ProtectedRoute from "./auth/ProtectedRoute";
import { UserType } from "./types";

function App() {
  const { loading } = useAuth();

  if (loading) {
    return <Preloader message="Initializing app..." showMessage={true} />;
  }

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Main app structure wrapped by BasePage */} 
        <Route path="/*" element={
          <Suspense fallback={<Preloader message="Loading dashboard..." showMessage={true} />}>
            <BasePage />
          </Suspense>
        }>
          {/* Routes accessible to all authenticated users */}
          <Route path="clients" element={
            <Suspense fallback={<LoadingIndicator size={40} />}>
              <Spreadsheet />
            </Suspense>
          } />
          <Route path="calendar" element={
            <Suspense fallback={<LoadingIndicator size={40} />}>
              <CalendarPage />
            </Suspense>
          } />
          <Route path="profile/:clientId?" element={
            <Suspense fallback={<LoadingIndicator size={40} />}>
              <Profile />
            </Suspense>
          } />
          <Route path="delivery" element={
            <Suspense fallback={<LoadingIndicator size={40} />}>
              <DeliverySpreadsheet />
            </Suspense>
          } />
          {/* Routes with specific role requirements */}
          <Route element={<ProtectedRoute allowedRoles={[UserType.Admin, UserType.Manager]} />}>
            {/* Nested route for users, accessible only via ProtectedRoute */}
            <Route path="users" element={
              <Suspense fallback={<LoadingIndicator size={40} />}>
                <UsersSpreadsheet />
              </Suspense>
            } />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
