import React, { useEffect } from "react";
import { printAllEventDates } from "../dev/printAllEventDates";

const PrintAllEventDatesPage: React.FC = () => {
  useEffect(() => {
    printAllEventDates();
  }, []);

  return (
    <div style={{ padding: 32 }}>
      <h2>Print All Event Dates (Dev Tool)</h2>
      <p>Check the browser console for output of all delivery event dates from Firestore.</p>
    </div>
  );
};

export default PrintAllEventDatesPage;
