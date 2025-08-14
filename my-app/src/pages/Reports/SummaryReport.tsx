import React, { useState } from "react";
import "./Reports.css";
import { ReportField } from "../../types/reports-types";
import ReportTables from "./ReportTables";
import ReportHeader from "./ReportHeader";

const SummaryReport: React.FC = () => {
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
  const data: { [section: string]: ReportField[] } = {
    "Basic Output": [
      { key: "Households Served (Duplicated)", value: 200, isFullRow: false },
      { key: "Households Served (Unduplicated)", value: 150, isFullRow: false },
      { key: "People Served (Duplicated)", value: 350, isFullRow: false },
      { key: "People Served (Unduplicated)", value: 150, isFullRow: false },
      { key: "Bags Delivered", value: 150, isFullRow: false },
      { key: "New Households", value: 150, isFullRow: false },
      { key: "New People", value: 150, isFullRow: false },
      { key: "Active Clients", value: 150, isFullRow: false },
      { key: "Lapsed Clients", value: 150, isFullRow: false },
    ],
    "Demographics": [
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Adults Served", value: 350, isFullRow: false }
    ],
    "Health Conditions": [
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Adults Served", value: 350, isFullRow: false }
    ],
    "Referrals": [
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Adults Served", value: 350, isFullRow: false }
    ],
    "Dietary Restrictions": [
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Adults Served", value: 350, isFullRow: false }
    ],
    "FAM (Food as Medicine)": [
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Adults Served", value: 350, isFullRow: false }
    ],
    "Tags": [
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Adults Served", value: 350, isFullRow: false }
    ],
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh", 
      }}
    >
        <ReportHeader startDate={startDate} endDate = {endDate} setStartDate = {setStartDate} setEndDate = {setEndDate}></ReportHeader>
        <ReportTables data={data} loading={false}></ReportTables>
    </div>
  );
};

export default SummaryReport;
