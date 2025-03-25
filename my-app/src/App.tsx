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
import CalendarPage from "./components/Calendar/CalendarPage";
import Spreadsheet from "./components/Spreadsheet/Spreadsheet";

import Profile from './pages/Profile/Profile';
import BasePage from './pages/Base/Base';
import CreateUsers from './pages/CreateUsers/CreateUsers';
import DeliverySpreadsheet from "./pages/Delivery/DeliverySpreadsheet";


function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        
        {/* Protected or main routes wrapped with BasePage */}
        <Route
          path="/calendar"
          element={
            <BasePage>
              <CalendarPage />
            </BasePage>
          }
        />
        <Route path="/profile/:id" element={
          <BasePage>
          <Profile />
        </BasePage>
        } />
        <Route
          path="/profile"
          element={
            <BasePage>
              <Profile  />
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

        <Route
          path="/deliveryAssignment"
          element={
            <BasePage>
              <DeliverySpreadsheet />
            </BasePage>
          }
        />

        <Route
          path="/createUsers"
          element={
            <BasePage>
              <CreateUsers />
            </BasePage>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;