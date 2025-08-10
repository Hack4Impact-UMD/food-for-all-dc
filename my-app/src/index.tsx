import React from "react";
import ReactDOM from "react-dom/client";
import "./critical.css"; // Critical CSS loaded first
import "./index.css";
// ...removed font-awesome import...
import "./styles/form-styles.css";
import "./styles/form-field-global.css"; // Global form field styling with green glow and error states
import "./styles/radio-override.css"; // Match radio button styles to checkbox green color
import "./components/performance/performance.css"; // Performance CSS
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import PerformanceMonitor from "./services/performance-monitor";

// Initialize performance monitoring
const performanceMonitor = PerformanceMonitor.getInstance();
performanceMonitor.measureWebVitals();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Load web vitals only in production and when needed

// Performance monitoring in development
// if (process.env.NODE_ENV === 'development') {
//   // Log performance metrics every 10 seconds
//   setInterval(() => {
//     const metrics = performanceMonitor.getMetrics();
//     const recommendations = performanceMonitor.getRecommendations();
//     
//     if (Object.keys(metrics).length > 0) {
//       console.group('Performance Metrics');
//       console.table(metrics);
//       if (recommendations.length > 0) {
//         console.warn('Recommendations:', recommendations);
//       }
//       console.groupEnd();
//     }
//   }, 10000);
// }

// Preload critical routes after initial load
setTimeout(() => {
  // Preload commonly used routes
  import('./pages/Calendar/CalendarPage');
  import('./components/Spreadsheet/Spreadsheet');
  import('./pages/Profile/Profile');
}, 1000);
