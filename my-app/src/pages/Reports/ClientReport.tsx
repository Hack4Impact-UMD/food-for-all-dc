import React, { useState } from "react";
import { ReportField } from "../../types/reports-types";
import ReportHeader from "./ReportHeader";
import ReportTables from "./ReportTables";
import UsersSpreadsheet from "../../components/UsersSpreadsheet/UsersSpreadsheet";
import Spreadsheet from "../../components/Spreadsheet/Spreadsheet";
import { Typography } from "@mui/material";

const ClientReport: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(() => {
    const start = localStorage.getItem("ffaReportDateRangeStart");
    if (start) {
      return new Date(start);
    } else {
      return null;
    }
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    const end = localStorage.getItem("ffaReportDateRangeEnd");
    if (end) {
      return new Date(end);
    } else {
      return null;
    }
  });

  //hardcoded data which will later be fetched and calculated

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "90vh", 
      }}
    >
      <div
        style={{
          height: "fit-content",
        }}
      >
        <ReportHeader startDate={startDate} endDate = {endDate} setStartDate = {setStartDate} setEndDate = {setEndDate}></ReportHeader>
        <Typography sx={{color:"var(--color-primary)", fontSize:"30px", fontWeight:"bold", textDecoration:"underline"}}>Active Clients</Typography>
        <Spreadsheet editable={false}></Spreadsheet>

        <Typography sx={{color:"var(--color-primary)", fontSize:"30px", fontWeight:"bold", textDecoration:"underline"}}>Lapsed Clients</Typography>
        <Spreadsheet editable={false}></Spreadsheet>
      </div>
    </div>
  );
};

export default ClientReport;
