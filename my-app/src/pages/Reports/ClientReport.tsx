import React, { useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNavigate } from "react-router-dom";
import { DateTime } from "luxon";
import { useNotifications } from "../../components/NotificationProvider";
import Guide from "./Guide";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import SnapshotReportHeader from "./SnapshotReportHeader";
import { exportToCSV } from "../../utils/reportExport";
import { CsvExportError, CsvRow } from "../../utils/csvExport";
import TimeUtils from "../../utils/timeUtils";
import {
  loadAllReportClients,
  loadLatestPastDeliveryDatesByClientIds,
} from "./reportDataLoader";
import {
  buildClientReportData,
  ClientReportData,
  SnapshotClientRecord,
} from "./reportUtils";

const formatReportDateValue = (value: unknown): string => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  const normalizedDate = TimeUtils.fromAny(value as string | Date | DateTime);
  return normalizedDate.isValid ? normalizedDate.toISODate() || "" : "";
};

const ClientReport: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess, showWarning } = useNotifications();

  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState<DateTime | null>(null);
  const [data, setData] = useState<ClientReportData>({ Active: [], Lapsed: [], Inactive: [] });

  const snapshotTimestamp = snapshotDate ?? TimeUtils.now().startOf("day");
  const snapshotLabel = `Current Report as of ${snapshotTimestamp.toFormat("M/d/yyyy")}`;
  const isExportDisabled = isLoading || !hasGenerated;

  const handleExport = () => {
    const csvData: CsvRow[] = [];
    const sections: Array<keyof ClientReportData> = ["Active", "Lapsed", "Inactive"];

    sections.forEach((section) => {
      data[section].forEach((client) => {
        csvData.push({
          Status: section,
          "Client ID": client.uid,
          "First Name": client.firstName,
          "Last Name": client.lastName,
          Phone: client.phone || "",
          Address: client.address || "",
          Zip: client.zipCode || "",
          "Start Date": formatReportDateValue(client.startDate),
          "End Date": formatReportDateValue(client.endDate),
          "Last Delivery Date": client.lastDeliveryDate || "",
          "Snapshot Date": snapshotTimestamp.toISODate() || "",
        });
      });
    });

    try {
      const filename = `Snapshot_Client_Report_${snapshotTimestamp.toISODate() || "current"}.csv`;
      const exportedFilename = exportToCSV(csvData, filename);
      showSuccess(`Exported ${exportedFilename}.`);
    } catch (error) {
      if (error instanceof CsvExportError && error.code === "EMPTY_DATA") {
        showWarning(error.message);
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to export snapshot client report.";
      showError(message);
    }
  };

  const generateReport = async () => {
    setIsLoading(true);
    try {
      const today = TimeUtils.now().startOf("day");
      const clients = await loadAllReportClients();
      const latestPastDeliveryDatesByClientId = await loadLatestPastDeliveryDatesByClientIds(
        clients.map((client) => client.uid),
        today.endOf("day")
      );

      setData(buildClientReportData(clients, latestPastDeliveryDatesByClientId, today));
      setSnapshotDate(today);
      setHasGenerated(true);
      showSuccess("Snapshot client report generated successfully");
    } catch (error) {
      console.error("Failed to generate snapshot client report:", error);
      showError("Failed to generate snapshot client report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const sections: Array<{ key: keyof ClientReportData; index: number; label: string }> = [
    { key: "Active", index: 0, label: "Active" },
    { key: "Lapsed", index: 1, label: "Lapsed" },
    { key: "Inactive", index: 2, label: "Inactive" },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "90vh", width: "90vw" }}>
      <SnapshotReportHeader
        snapshotLabel={snapshotLabel}
        onGenerate={generateReport}
        onExport={handleExport}
        exportDisabled={isExportDisabled}
        isGenerating={isLoading}
      />

      {isLoading && <LoadingIndicator />}

      {!isLoading && !hasGenerated && (
        <Guide
          title="Getting Started with Snapshot Client Report:"
          description="Click Generate to see today's active, lapsed, and inactive client snapshot."
        />
      )}

      {!isLoading && hasGenerated && (
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 2,
            width: "90vw",
            bgcolor: "background.paper",
          }}
        >
          {sections.map(({ key, index, label }) => {
            const clients = data[key] ?? [];
            return (
              <Accordion
                key={key}
                sx={{
                  width: "100%",
                  mb: 1,
                  bgcolor: "var(--color-white)",
                  border: "none",
                  boxShadow: "none",
                  borderRadius: 2,
                  overflow: "hidden",
                  p: 0,
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: "var(--color-white)" }} />}
                  aria-controls={`panel${index}-content`}
                  id={`panel${index}-header`}
                  sx={{
                    bgcolor: "var(--color-primary)",
                    color: "var(--color-white)",
                    mb: 0.5,
                    borderTopLeftRadius: 2,
                    borderTopRightRadius: 2,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="h6" sx={{ mr: 1 }}>
                      {label}
                    </Typography>
                    <Typography sx={{ opacity: 0.9 }}>({clients.length})</Typography>
                  </Box>
                </AccordionSummary>

                <AccordionDetails
                  sx={{ bgcolor: "var(--color-white)", color: "var(--color-black)", p: 0 }}
                >
                  {clients.length === 0 ? (
                    <Box sx={{ p: 2, bgcolor: "var(--color-background-lighter)", borderRadius: 1 }}>
                      <Typography sx={{ color: "text.secondary" }}>No clients.</Typography>
                    </Box>
                  ) : (
                    clients.map((client: SnapshotClientRecord, itemIndex: number) => (
                      <Box
                        key={`${key}-${client.uid ?? itemIndex}`}
                        sx={{
                          minHeight: 88,
                          bgcolor: "#f0f0f0ff",
                          mb: 1.25,
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 2,
                          p: 2,
                        }}
                      >
                        <Box>
                          <Typography
                            sx={{
                              color: "var(--color-primary)",
                              fontWeight: "bold",
                              textDecoration: "underline",
                              fontSize: 17,
                              cursor: "pointer",
                              mb: 0.5,
                            }}
                            onClick={() => {
                              navigate(`/profile/${client.uid}`);
                            }}
                          >
                            {client.firstName} {client.lastName}
                          </Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Last delivery: {client.lastDeliveryDate || "None"} | End date:{" "}
                            {formatReportDateValue(client.endDate) || "N/A"}
                          </Typography>
                        </Box>
                      </Box>
                    ))
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default ClientReport;
