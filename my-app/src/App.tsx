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

// Performance monitoring
import { usePerformanceMonitor } from "./hooks/usePerformance";
import { ErrorBoundary } from "./components/performance/LoadingComponents";
import { routesConfig } from "./routesConfig";
import NotFoundPage from "./components/NotFoundPage";
import AutoLogout from "./components/AutoLogout";

function renderRoutes(config: Array<any>) {
  return config.map((route: any, idx: number) => {
    if (route.children) {
      return (
        <Route key={idx} path={route.path} element={route.element}>
          {renderRoutes(route.children)}
        </Route>
      );
    }
    return (
      <Route key={idx} path={route.path} element={route.element} />
    );
  });
}

function App() {
  const { loading } = useAuth();
  
  // Monitor app performance
  usePerformanceMonitor('App');

  if (loading) {
    return <Preloader message="Initializing app..." showMessage={true} />;
  }

  return (
    <ErrorBoundary>
      <Router>
        {/* <AutoLogout></AutoLogout> */}
        <Suspense fallback={<LoadingIndicator />}>
          <Routes>
            {renderRoutes(routesConfig)}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
