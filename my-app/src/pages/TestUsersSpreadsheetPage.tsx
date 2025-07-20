import React from "react";
import UsersSpreadsheet from "../components/UsersSpreadsheet/UsersSpreadsheet";

const TestUsersSpreadsheetPage: React.FC = () => {
  // Minimal mock for onAuthStateChanged to prevent redirect
  const mockOnAuthStateChanged = (auth: any, callback: any) => {
    callback({ uid: "test-uid", email: "test@example.com" });
    // intentionally empty cleanup function
    return () => { /* noop */ };
  };
  return <UsersSpreadsheet onAuthStateChangedOverride={mockOnAuthStateChanged} />;
};

export default TestUsersSpreadsheetPage;
