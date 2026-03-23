import React, { useState } from "react";
import "./Reports.css";
import ReportTables from "./ReportTables";
import ReportHeader from "./ReportHeader";
import { Alert, Box } from "@mui/material";
import TimeUtils from "../../utils/timeUtils";
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
import { CsvExportError, CsvRow } from "../../utils/csvExport";
import { buildSummaryReportData, createEmptySummaryReport } from "./reportUtils";
import {
  loadReportClientsByIds,
  loadFirstDeliveriesByClientIds,
  loadInclusiveReportEvents,
} from "./reportDataLoader";

const LEGACY_SNAPSHOT_NOTICE =
  "Some deliveries in this range predate household snapshots. Historical people counts use current household size for those legacy deliveries.";

const SummaryReport: React.FC = () => {
  const { showError, showSuccess, showWarning } = useNotifications();
  // Shows spinner while generateReport is running
  const [isLoading, setIsLoading] = useState(false);
  // Tracks whether at least one report has been generated
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedRangeKey, setGeneratedRangeKey] = useState("");
  const [data, setData] = useState<SummaryData>(() => createEmptySummaryReport());
  const [legacySnapshotNotice, setLegacySnapshotNotice] = useState<string | null>(null);

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
    const csvData: CsvRow[] = legacySnapshotNotice
      ? [
          {
            Section: "Notice",
            Metric: legacySnapshotNotice,
            Value: "",
          },
          {
            Section: "",
            Metric: "",
            Value: "",
          },
        ]
      : [];

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

    setIsLoading(true);

    const start = TimeUtils.fromJSDate(startDate).startOf("day");
    const end = TimeUtils.fromJSDate(endDate).endOf("day");
    const today = TimeUtils.now().endOf("day");

    if (start > today || end > today) {
      showError("Summary reports can only be generated through today.");
      setIsLoading(false);
      return;
    }

    try {
      const servedEvents = await loadInclusiveReportEvents(start, end);
      const servedClientIds = Array.from(new Set(servedEvents.map((event) => event.clientId)));
      const [clients, firstDeliveriesByClientId] = await Promise.all([
        loadReportClientsByIds(servedClientIds),
        loadFirstDeliveriesByClientIds(servedClientIds),
      ]);
      const reportResult = buildSummaryReportData({
        clients,
        servedEvents,
        firstDeliveriesByClientId,
        start,
        end,
      });

      setData(reportResult.data);
      setLegacySnapshotNotice(
        reportResult.usedLegacySnapshotFallback ? LEGACY_SNAPSHOT_NOTICE : null
      );
      setHasGenerated(true);
      setGeneratedRangeKey(currentRangeKey);

      if (reportResult.usedLegacySnapshotFallback) {
        showWarning(LEGACY_SNAPSHOT_NOTICE);
      }

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
        maxDate={new Date()}
        generateReport={generateReport}
        onExport={handleExport}
        exportDisabled={isExportDisabled}
        isGenerating={isLoading}
      />

      {isLoading && <LoadingIndicator />}

      {!isLoading && !hasGenerated && <Guide />}
      {hasGenerated && (
        <Box sx={{ width: "90vw" }}>
          {legacySnapshotNotice && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {legacySnapshotNotice}
            </Alert>
          )}
          <ReportTables data={data} loading={isLoading}></ReportTables>
        </Box>
      )}
    </div>
  );
};

export default SummaryReport;
