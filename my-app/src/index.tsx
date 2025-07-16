import React from "react";
import ReactDOM from "react-dom/client";
import "./critical.css"; // Critical CSS loaded first
import "./index.css";
import "font-awesome/css/font-awesome.min.css";
import "./styles/form-styles.css";
import "./styles/form-field-global.css"; // Global form field styling with green glow and error states
import "./styles/radio-override.css"; // Match radio button styles to checkbox green color
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Load web vitals only in production and when needed
if (process.env.NODE_ENV === 'production') {
  import('./reportWebVitals').then(({ default: reportWebVitals }) => {
    reportWebVitals();
  });
}

// Preload critical routes after initial load
setTimeout(() => {
  // Preload commonly used routes
  import('./pages/Calendar/CalendarPage');
  import('./components/Spreadsheet/Spreadsheet');
  import('./pages/Profile/Profile');
}, 2000);
