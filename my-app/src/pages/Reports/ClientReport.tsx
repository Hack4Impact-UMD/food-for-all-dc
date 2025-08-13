import React, { useState } from "react";
import { ReportField } from "../../types/reports-types";
import ReportHeader from "./ReportHeader";
import ReportTables from "./ReportTables";
import UsersSpreadsheet from "../../components/UsersSpreadsheet/UsersSpreadsheet";
import Spreadsheet from "../../components/Spreadsheet/Spreadsheet";

const ClientReport: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  //hardcoded data which will later be fetched and calculated

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh", 
      }}
    >
        <ReportHeader startDate={startDate} endDate = {endDate} setStartDate = {setStartDate} setEndDate = {setEndDate}></ReportHeader>
        <Spreadsheet></Spreadsheet>
    </div>
  );
};

export default ClientReport;
