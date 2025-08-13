import React, { useState } from "react";
import "./Reports.css";
import { ReportField } from "../../types/reports-types";
import ReportTables from "./ReportTables";
import ReportHeader from "./ReportHeader";

const SummaryReport: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  //hardcoded data which will later be fetched and calculated 
  const data: { [section: string]: ReportField[] } = {
    "Basic Output": [
      { key: "Households Served", value: 200, isFullRow: false },
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Adults Served", value: 350, isFullRow: false },
      { key: "Children Served", value: 150, isFullRow: false },
      { key: "Children Served", value: 150, isFullRow: false },
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
        <ReportTables data={data}></ReportTables>
    </div>
  );
};

export default SummaryReport;
