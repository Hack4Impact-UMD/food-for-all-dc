import React from "react";
import ReactDOM from "react-dom/client";
import "./critical.css";
import "./index.css";
import "./styles/form-styles.css";
import "./styles/form-field-global.css";
import "./styles/radio-override.css";
import "./components/performance/performance.css";
import "./styles/google-places-dropdown.css";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import PerformanceMonitor from "./services/performance-monitor";

const performanceMonitor = PerformanceMonitor.getInstance();
performanceMonitor.measureWebVitals();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </AuthProvider>
  </React.StrictMode>
);

setTimeout(() => {
  import("./pages/Calendar/CalendarPage");
  import("./components/Spreadsheet/Spreadsheet");
  import("./pages/Profile/Profile");
}, 1000);
