import React, { useState } from "react";
import "./Reports.css";
import ReportTables from "./ReportTables";
import ReportHeader from "./ReportHeader";
import TimeUtils from "../../utils/timeUtils";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import dataSources from "../../config/dataSources";
import { db } from "../../auth/firebaseConfig";
import { SummaryData } from "../../types/reports-types";
import Guide from "./Guide";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { useNotifications } from "../../components/NotificationProvider";
import {
  exportToCSV,
  formatDateRange,
  getReportRangeKey,
  isReportExportDisabled,
} from "../../utils/reportExport";
import { CsvExportError } from "../../utils/csvExport";
import {
  buildSummaryReportData,
  createEmptySummaryReport,
  SummaryClientRecord,
} from "./reportUtils";

const SummaryReport: React.FC = () => {
  const { showError, showSuccess, showWarning } = useNotifications();
  // Shows spinner while generateReport is running
  const [isLoading, setIsLoading] = useState(false);
  // Tracks whether at least one report has been generated
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedRangeKey, setGeneratedRangeKey] = useState("");
  const [data, setData] = useState<SummaryData>(() => createEmptySummaryReport());

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
  const currentRangeKey = getReportRangeKey(startDate, endDate);
  const isExportDisabled = isReportExportDisabled({
    isLoading,
    hasGenerated,
    generatedRangeKey,
    currentRangeKey,
  });

  const handleExport = () => {
    const csvData: any[] = [];

    Object.entries(data).forEach(([section, fields]) => {
      csvData.push({
        Section: section,
        Metric: "",
        Value: "",
      });

      Object.entries(fields).forEach(([metric, fieldData]) => {
        csvData.push({
          Section: "",
          Metric: metric,
          Value: fieldData.value,
        });
      });

      csvData.push({
        Section: "",
        Metric: "",
        Value: "",
      });
    });

    const dateRange = formatDateRange(startDate, endDate);
    const filename = `Summary_Report_${dateRange}.csv`;
    try {
      const exportedFilename = exportToCSV(csvData, filename);
      showSuccess(`Exported ${exportedFilename}.`);
    } catch (error) {
      if (error instanceof CsvExportError && error.code === "EMPTY_DATA") {
        showWarning(error.message);
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to export summary report.";
      showError(message);
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      return;
    }

    const BATCH_SIZE = 50;
    setIsLoading(true);

    const start = TimeUtils.fromJSDate(startDate).startOf("day");
    const end = TimeUtils.fromJSDate(endDate).endOf("day");

    try {
      const clients: SummaryClientRecord[] = [];
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
      const True = true;
      while (True) {
        const q = lastDoc
          ? query(
              collection(db, dataSources.firebase.clientsCollection),
              orderBy("__name__"),
              startAfter(lastDoc),
              limit(BATCH_SIZE)
            )
          : query(
              collection(db, dataSources.firebase.clientsCollection),
              orderBy("__name__"),
              limit(BATCH_SIZE)
            );

        const snap: any = await getDocs(q);
        if (snap.empty) break;

        for (const doc of snap.docs) {
          clients.push(doc.data() as SummaryClientRecord);
        }

        lastDoc = snap.docs[snap.docs.length - 1];

        if (snap.size < BATCH_SIZE) break;
      }

      setData(buildSummaryReportData(clients, start, end));
      setHasGenerated(true);
      setGeneratedRangeKey(currentRangeKey);
      showSuccess("Summary report generated successfully");
    } catch (err) {
      console.error("Failed to generate report:", err);
      showError("Failed to generate summary report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "90vh",
        position: "relative",
        width: "90vw",
      }}
    >
      <ReportHeader
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        generateReport={generateReport}
        onExport={handleExport}
        exportDisabled={isExportDisabled}
        isGenerating={isLoading}
      />

      {isLoading && <LoadingIndicator />}

      {!isLoading && !hasGenerated && <Guide />}
      {hasGenerated && <ReportTables data={data} loading={isLoading}></ReportTables>}
    </div>
  );
};

export default SummaryReport;
