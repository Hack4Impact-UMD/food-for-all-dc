// Centralized route configuration for Food for All DC
import React from 'react';
import Login from "./pages/Login/Login";
import ForgotPasswordPage from "./pages/Login/forgot-password";
import CalendarPage from "./pages/Calendar/CalendarPage";
import Spreadsheet from "./components/Spreadsheet/Spreadsheet";
import UsersSpreadsheet from "./components/UsersSpreadsheet/UsersSpreadsheet";
import Profile from "./pages/Profile/Profile";
import BasePage from "./pages/Base/Base";
import DeliverySpreadsheet from "./pages/Delivery/DeliverySpreadsheet";
import ProtectedRoute from "./auth/ProtectedRoute";
import { UserType } from "./types";

export interface RouteMeta {
  title?: string;
  description?: string;
  icon?: string;
}

export interface AppRoute {
  path?: string;
  element?: React.ReactNode;
  public?: boolean;
  meta?: RouteMeta;
  children?: AppRoute[];
}

export const routesConfig: AppRoute[] = [
  {
    path: "/",
    element: <Login />,
    public: true,
    meta: { title: "Login", description: "User login page", icon: "login" },
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
    public: true,
    meta: { title: "Forgot Password", description: "Password recovery page", icon: "lock" },
  },
  {
    path: "/*",
    element: <BasePage />,
    meta: { title: "Dashboard", description: "Main app dashboard", icon: "dashboard" },
    children: [
      {
        path: "clients",
        element: <Spreadsheet />,
        meta: { title: "Clients", description: "Client management spreadsheet", icon: "group" },
      },
      {
        path: "calendar",
        element: <CalendarPage />,
        meta: { title: "Calendar", description: "Delivery and event calendar", icon: "calendar_today" },
      },
      // DEV ROUTE: Print all event dates under /calendar
      {
        path: "profile/:clientId?",
        element: <Profile />,
        meta: { title: "Profile", description: "Client profile page", icon: "person" },
      },
      {
        path: "delivery",
        element: <DeliverySpreadsheet />,
        meta: { title: "Delivery", description: "Delivery management", icon: "local_shipping" },
      },
      {
        element: <ProtectedRoute allowedRoles={[UserType.Admin, UserType.Manager]} />,
        children: [
          {
            path: "users",
            element: <UsersSpreadsheet />,
            meta: { title: "Users", description: "User management spreadsheet", icon: "admin_panel_settings" },
          },
        ],
      },
    ],
  },
];
