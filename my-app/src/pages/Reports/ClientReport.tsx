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
import { deliveryDate } from "../../utils/deliveryDate";
import {
  loadAllReportClients,
  loadRecentDeliveryDatesByClientIds,
  loadLatestPastDeliveryDatesByClientIds,
} from "./reportDataLoader";
import {
  buildClientReportData,
  ClientReportData,
  ReportClientRecord,
  SnapshotClientRecord,
  SupportedDateInput,
  SNAPSHOT_REPORT_RECENT_DELIVERY_DAYS,
} from "./reportUtils";

const formatReportDateValue = (value: SupportedDateInput): string => {
  if (!value) {
    return "";
  }

  return deliveryDate.tryToISODateString(value) ?? "";
};

const mapPersistedLastDeliveryDates = (
  clients: ReportClientRecord[],
  today: DateTime
): Map<string, string> => {
  const seededDates = new Map<string, string>();

  clients.forEach((client) => {
    const normalizedDate = deliveryDate.tryToISODateString(client.lastDeliveryDate);
    if (!normalizedDate) {
      return;
    }

    if (deliveryDate.compare(normalizedDate, today.toISODate() || normalizedDate) <= 0) {
      seededDates.set(client.uid, normalizedDate);
    }
  });

  return seededDates;
};

const ClientReport: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess, showWarning } = useNotifications();

  const [isLoading, setIsLoading] = useState(false);
  const [isEnrichingLastDeliveryDates, setIsEnrichingLastDeliveryDates] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState<DateTime | null>(null);
  const [data, setData] = useState<ClientReportData>({ Active: [], Lapsed: [], Inactive: [] });

  const snapshotTimestamp = snapshotDate ?? TimeUtils.now().startOf("day");
  const snapshotLabel = `Current Report as of ${snapshotTimestamp.toFormat("M/d/yyyy")}`;
  const isExportDisabled = isLoading || isEnrichingLastDeliveryDates || !hasGenerated;

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
    setIsEnrichingLastDeliveryDates(false);
    const reportStartMs = performance.now();
    try {
      const today = TimeUtils.now().startOf("day");
      const recentWindowStart = today.minus({ days: SNAPSHOT_REPORT_RECENT_DELIVERY_DAYS });
      const fetchStartMs = performance.now();
      const [clients, recentDeliveryDatesByClientId] = await Promise.all([
        loadAllReportClients(),
        loadRecentDeliveryDatesByClientIds(recentWindowStart, today.endOf("day")),
      ]);
      const persistedDeliveryDatesByClientId = mapPersistedLastDeliveryDates(clients, today);
      const seededDeliveryDatesByClientId = new Map([
        ...persistedDeliveryDatesByClientId,
        ...recentDeliveryDatesByClientId,
      ]);
      const fetchDurationMs = Math.round(performance.now() - fetchStartMs);

      const preliminaryReport = buildClientReportData(
        clients,
        seededDeliveryDatesByClientId,
        today
      );
      const lapsedClientIds = preliminaryReport.Lapsed.map((client) => client.uid);
      setData(preliminaryReport);
      setSnapshotDate(today);
      setHasGenerated(true);
      showSuccess("Snapshot client report generated successfully");
      const initialRenderDurationMs = Math.round(performance.now() - reportStartMs);
      console.info(
        `[SnapshotReportPerf] initialMs=${initialRenderDurationMs} fetchMs=${fetchDurationMs} clients=${clients.length} persistedDates=${persistedDeliveryDatesByClientId.size} recentDates=${recentDeliveryDatesByClientId.size} lapsed=${lapsedClientIds.length}`
      );

      if (lapsedClientIds.length > 0) {
        setIsEnrichingLastDeliveryDates(true);
        void (async () => {
          const enrichStartMs = performance.now();
          try {
            const fallbackDeliveryDatesByClientId = await loadLatestPastDeliveryDatesByClientIds(
              lapsedClientIds,
              today.endOf("day")
            );

            if (fallbackDeliveryDatesByClientId.size === 0) {
              return;
            }

            const latestPastDeliveryDatesByClientId = new Map([
              ...seededDeliveryDatesByClientId,
              ...fallbackDeliveryDatesByClientId,
            ]);

            setData(buildClientReportData(clients, latestPastDeliveryDatesByClientId, today));
            const enrichDurationMs = Math.round(performance.now() - enrichStartMs);
            console.info(
              `[SnapshotReportPerf] enrichMs=${enrichDurationMs} fallbackDates=${fallbackDeliveryDatesByClientId.size}`
            );
          } catch (error) {
            console.error("Failed to enrich snapshot client report with older deliveries:", error);
          } finally {
            setIsEnrichingLastDeliveryDates(false);
          }
        })();
      }
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
                            component="button"
                            type="button"
                            sx={{
                              color: "var(--color-primary)",
                              fontWeight: "bold",
                              textDecoration: "underline",
                              fontSize: 17,
                              cursor: "pointer",
                              mb: 0.5,
                              background: "none",
                              border: 0,
                              p: 0,
                              fontFamily: "inherit",
                              textAlign: "left",
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
