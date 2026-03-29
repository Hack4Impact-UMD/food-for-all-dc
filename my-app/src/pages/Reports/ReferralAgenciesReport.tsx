import React, { useState } from "react";
import ReportHeader from "./ReportHeader";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TimeUtils from "../../utils/timeUtils";
import { useNavigate } from "react-router-dom";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import Guide from "./Guide";
import { useNotifications } from "../../components/NotificationProvider";
import {
  exportToCSV,
  formatDateRange,
  getReportRangeKey,
  isReportExportDisabled,
} from "../../utils/reportExport";
import { CsvExportError, CsvRow } from "../../utils/csvExport";
import {
  loadFirstDeliveriesByClientIds,
  loadInclusiveReportEvents,
  loadReportClientsByIds,
} from "./reportDataLoader";
import {
  buildReferralAgenciesReportData,
  ReferralAgenciesReportData,
  ReferralReportClient,
} from "./reportUtils";
import { deliveryDate } from "../../utils/deliveryDate";

const readStoredReportDate = (storageKey: string): Date | null => {
  const rawValue = localStorage.getItem(storageKey);
  return rawValue ? deliveryDate.tryToJSDate(rawValue) : null;
};

const ReferralAgenciesReport: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess, showWarning } = useNotifications();

  const [expandedPanels, setExpandedPanels] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generatedRangeKey, setGeneratedRangeKey] = useState("");
  const [data, setData] = useState<ReferralAgenciesReportData>({});

  const [startDate, setStartDate] = useState<Date | null>(() =>
    readStoredReportDate("ffaReportDateRangeStart")
  );

  const [endDate, setEndDate] = useState<Date | null>(() =>
    readStoredReportDate("ffaReportDateRangeEnd")
  );

  const currentRangeKey = getReportRangeKey(startDate, endDate);
  const isExportDisabled = isReportExportDisabled({
    isLoading,
    hasGenerated,
    generatedRangeKey,
    currentRangeKey,
  });

  const handleExport = () => {
    const csvData: CsvRow[] = [];

    Object.entries(data).forEach(([agency, clients]) => {
      clients.forEach((client) => {
        csvData.push({
          "Referral Agency": agency,
          "First Name": client.firstName,
          "Last Name": client.lastName,
          "Referral Date": client.referredDate,
          "First Delivery Date": client.firstDeliveryDate,
          "Client ID": client.id,
        });
      });
    });

    const dateRange = formatDateRange(startDate, endDate);
    const filename = `Referral_Agencies_Report_${dateRange}.csv`;
    try {
      const exportedFilename = exportToCSV(csvData, filename);
      showSuccess(`Exported ${exportedFilename}.`);
    } catch (error) {
      if (error instanceof CsvExportError && error.code === "EMPTY_DATA") {
        showWarning(error.message);
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to export referral agencies report.";
      showError(message);
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      return;
    }

    setIsLoading(true);
    try {
      const start = TimeUtils.fromJSDate(startDate).startOf("day");
      const end = TimeUtils.fromJSDate(endDate).endOf("day");
      const today = TimeUtils.now().endOf("day");

      if (start > today || end > today) {
        showError("Referral reports can only be generated through today.");
        setIsLoading(false);
        return;
      }

      const servedEvents = await loadInclusiveReportEvents(start, end);
      const servedClientIds = Array.from(new Set(servedEvents.map((event) => event.clientId)));
      const [clients, firstDeliveriesByClientId] = await Promise.all([
        loadReportClientsByIds(servedClientIds),
        loadFirstDeliveriesByClientIds(servedClientIds),
      ]);

      setData(
        buildReferralAgenciesReportData({
          clients,
          firstDeliveriesByClientId,
          start,
          end,
        })
      );

      setExpandedPanels([]);
      setHasGenerated(true);
      setGeneratedRangeKey(currentRangeKey);
      showSuccess("Referral agencies report generated successfully");
    } catch (error) {
      console.error("Failed to generate referral agencies report:", error);
      showError("Failed to generate referral agencies report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (index: number) => {
    setExpandedPanels((prev) =>
      prev.includes(index) ? prev.filter((panelIndex) => panelIndex !== index) : [...prev, index]
    );
  };

  const expandAllPanels = () => {
    setExpandedPanels(Array.from({ length: Object.keys(data).length }, (_, index) => index));
  };

  const collapseAllPanels = () => {
    setExpandedPanels([]);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "90vh", width: "90vw" }}>
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
          <Box
            sx={{
              display: "flex",
              gap: 1,
              color: "var(--color-primary)",
              fontWeight: "bold",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography
              onClick={expandAllPanels}
              sx={{
                fontWeight: "bold",
                cursor: "pointer",
                "&:hover": { opacity: 0.7 },
              }}
            >
              Expand All
            </Typography>

            <Typography>|</Typography>

            <Typography
              onClick={collapseAllPanels}
              sx={{
                fontWeight: "bold",
                cursor: "pointer",
                "&:hover": { opacity: 0.9 },
              }}
            >
              Collapse All
            </Typography>
          </Box>

          {Object.entries(data).map(([agencyKey, clients], index) => (
            <Accordion
              key={agencyKey}
              expanded={expandedPanels.includes(index)}
              onChange={() => handleToggle(index)}
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
                    {agencyKey}
                  </Typography>
                  <Typography sx={{ opacity: 0.9 }}>({clients.length})</Typography>
                </Box>
              </AccordionSummary>

              <AccordionDetails
                sx={{ bgcolor: "var(--color-white)", color: "var(--color-black)", p: 0 }}
              >
                {clients.map((client: ReferralReportClient, clientIndex: number) => (
                  <Box
                    key={`${index}-${clientIndex}`}
                    sx={{
                      minHeight: 120,
                      bgcolor: "#f0f0f0ff",
                      mb: 1.25,
                      width: "100%",
                      display: "flex",
                      p: 2.5,
                      justifyContent: "center",
                      flexDirection: "column",
                    }}
                  >
                    <Typography
                      sx={{
                        color: "var(--color-primary)",
                        fontWeight: "bold",
                        textDecoration: "underline",
                        fontSize: 17,
                        cursor: "pointer",
                      }}
                      onClick={() => navigate(`/profile/${client.id}`)}
                    >
                      {client.firstName} {client.lastName}
                    </Typography>
                    <Typography sx={{ m: 0 }}>
                      Referral Date: {client.referredDate || "—"}
                    </Typography>
                    <Typography sx={{ m: 0 }}>
                      First Delivery Date: {client.firstDeliveryDate || "—"}
                    </Typography>
                  </Box>
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ReferralAgenciesReport;
