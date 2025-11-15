import dataSources from "../../config/dataSources";
import React, { useState } from "react";
import ReportHeader from "./ReportHeader";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import { ClientProfile } from "../../types";
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
import { db } from "../../auth/firebaseConfig";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNotifications } from "../../components/NotificationProvider";
import { useNavigate } from "react-router-dom";
import Guide from "./Guide";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import { exportToCSV, formatDateRange } from "../../utils/reportExport";

const ClientReport: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();

  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

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

  const [data, setData] = useState<any>({ Active: [], Lapsed: [] });

  const handleExport = () => {
    const csvData: any[] = [];

    const activeClients = data["Active"] || [];
    const lapsedClients = data["Lapsed"] || [];

    activeClients.forEach((client: ClientProfile) => {
      csvData.push({
        Status: "Active",
        "First Name": client.firstName,
        "Last Name": client.lastName,
        "Client ID": client.uid,
        Phone: client.phone || "",
        Address: client.address || "",
        Zip: client.zipCode || "",
      });
    });

    lapsedClients.forEach((client: ClientProfile) => {
      csvData.push({
        Status: "Lapsed",
        "First Name": client.firstName,
        "Last Name": client.lastName,
        "Client ID": client.uid,
        Phone: client.phone || "",
        Address: client.address || "",
        Zip: client.zipCode || "",
      });
    });

    const dateRange = formatDateRange(startDate, endDate);
    const filename = `Client_Report_${dateRange}.csv`;
    exportToCSV(csvData, filename);
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      return {};
    }

    setIsLoading(true);
    try {
      const BATCH_SIZE = 50;

      const start = TimeUtils.fromJSDate(startDate).startOf("day");
      const end = TimeUtils.fromJSDate(endDate).endOf("day");

      const allClients: ClientProfile[] = [];
      const activeClients: ClientProfile[] = [];

      try {
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        const True = true;
        while (True) {
          const q: any = lastDoc
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

          const snap = await getDocs(q);
          if (snap.empty) break;

          for (const doc of snap.docs) {
            const client = doc.data() as ClientProfile;
            allClients.push(client);

            const deliveries: string[] = client.deliveries ?? [];
            if (deliveries.length) {
              const deliveriesInRange = deliveries.filter((deliveryISO: string) => {
                const deliveryDate = TimeUtils.fromISO(deliveryISO);
                return deliveryDate >= start && deliveryDate <= end;
              });

              if (deliveriesInRange.length > 0) {
                activeClients.push(client);
              }
            }
          }

          lastDoc = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot<DocumentData>;
          if (snap.size < BATCH_SIZE) break;
        }
      } catch (err) {
        console.error("Failed to build Active/Lapsed map:", err);
        throw err;
      }

      //lapsed = All - Active (by document id)
      const activeIds = new Set(activeClients.map((c) => c.uid));
      const lapsedClients = allClients.filter((c) => !activeIds.has(c.uid));

      setData({
        Active: activeClients,
        Lapsed: lapsedClients,
      });
      setHasGenerated(true);
      showSuccess("Client report generated successfully");
    } catch (error) {
      console.error("Failed to generate client report:", error);
      showError("Failed to generate client report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const sections: Array<{ key: string; index: number; label: string }> = [
    { key: "Active", index: 0, label: "Active" },
    { key: "Lapsed", index: 1, label: "Lapsed" },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "90vh", width: "90vw" }}>
      <ReportHeader
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        generateReport={generateReport}
        onExport={handleExport}
        hasData={hasGenerated}
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
          {sections.map(({ key, index, label }) => {
            const clients = data?.[key] ?? [];
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
                    clients.map((client: any, i: any) => (
                      <Box
                        key={`${key}-${client.uid ?? i}`}
                        sx={{
                          height: 72,
                          bgcolor: "#f0f0f0ff",
                          mb: 1.25,
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          p: 2,
                          justifyContent: "space-between",
                          flexDirection: "row",
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
                          onClick={() => {
                            navigate(`/profile/${client.uid}`);
                          }}
                        >
                          {client.firstName} {client.lastName}
                        </Typography>
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
