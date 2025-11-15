import React, { useState, useRef } from "react";
import ReportHeader from "./ReportHeader";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { db } from "../../auth/firebaseConfig";
import {
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import dataSources from '../../config/dataSources';
import TimeUtils from "../../utils/timeUtils";
import { useNavigate } from "react-router-dom";
import LoadingIndicator from "../../components/LoadingIndicator/LoadingIndicator";
import Guide from "./Guide";
import { useNotifications } from "../../components/NotificationProvider";
import { exportToCSV, formatDateRange } from "../../utils/reportExport"; 

interface ReferralClient {
  id: string;
  firstName: string;
  lastName: string;
  referredDate: string;
}

const ReferralAgenciesReport: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotifications();

  const [expandedPanels, setExpandedPanels] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false); 

  const [data, setData] = useState<Record<string, ReferralClient[]>>({});

  const [startDate, setStartDate] = useState<Date | null>(() => {
    const start = localStorage.getItem("ffaReportDateRangeStart");
    return start ? new Date(start) : null;
  });

  const [endDate, setEndDate] = useState<Date | null>(() => {
    const end = localStorage.getItem("ffaReportDateRangeEnd");
    return end ? new Date(end) : null;
  });

  const caseworkerCacheRef = useRef<Record<string, string>>({});

  const getCaseworkerInformationById = async (id: string) => {
    if (caseworkerCacheRef.current[id]) return caseworkerCacheRef.current[id];

  const ref = doc(db, dataSources.firebase.caseWorkersCollection, id);
    const snap = await getDoc(ref);
    const cw = snap.data() as any;
    const formatted = `${cw?.name ?? "Unknown"} - ${cw?.organization ?? "—"}  (${cw?.email ?? "—"}, ${cw?.phone ?? "—"})`;

    caseworkerCacheRef.current[id] = formatted;
    return formatted;
  };

  const buildReport = async () => {
    const BATCH_SIZE = 50;

    if (!startDate || !endDate) return {};

    const start = TimeUtils.fromJSDate(startDate).startOf("day");
    const end = TimeUtils.fromJSDate(endDate).endOf("day");

    const byCaseworker: Record<string, ReferralClient[]> = {};
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

    try {
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

        for (const docSnap of snap.docs) {
          const client = docSnap.data();

          const caseworkerId: string | undefined = client?.referralEntity?.id;
          if (!caseworkerId) continue;

          if (!client.referredDate) continue;

          const referredDate = TimeUtils.fromISO(client.referredDate);
          if (referredDate < start || referredDate > end) continue;

          const caseworker = await getCaseworkerInformationById(caseworkerId);

          if (!byCaseworker[caseworker]) byCaseworker[caseworker] = [];
          byCaseworker[caseworker].push({
            id: docSnap.id,
            firstName: client.firstName,
            lastName: client.lastName,
            referredDate: client.referredDate,
          });
        }

        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < BATCH_SIZE) break;
      }
    } catch (err) {
      console.error("Failed to build caseworker report:", err);
    }

    return byCaseworker;
  };

  const handleExport = () => {
    const csvData: any[] = [];

    Object.entries(data).forEach(([agency, clients]) => {
      clients.forEach((client: ReferralClient) => {
        csvData.push({
          "Referral Agency": agency,
          "First Name": client.firstName,
          "Last Name": client.lastName,
          "Referral Date": client.referredDate,
          "Client ID": client.id
        });
      });
    });

    const dateRange = formatDateRange(startDate, endDate);
    const filename = `Referral_Agencies_Report_${dateRange}.csv`;
    exportToCSV(csvData, filename);
  };

  const generateReport = async () => {
    setIsLoading(true);
    try {
      const report = await buildReport();
      setData(report as Record<string, ReferralClient[]>);

      setExpandedPanels([]);
      setHasGenerated(true);
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
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const expandAllPanels = () => {
    setExpandedPanels(
      Array.from({ length: Object.keys(data || {}).length }, (_, i) => i)
    );
  };

  const collapseAllPanels = () => {
    setExpandedPanels([]);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "90vh", width: "90vw"}}>
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

          {Object.entries(data || {}).map(
            ([caseworkerKey, clients]: [string, ReferralClient[]], index) => (
              <Accordion
                key={caseworkerKey}
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
                      {caseworkerKey}
                    </Typography>
                    <Typography sx={{ opacity: 0.9 }}>
                      ({Array.isArray(clients) ? clients.length : 0})
                    </Typography>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ bgcolor: "var(--color-white)", color: "var(--color-black)", p: 0 }}>
                  {(clients || []).map(
                    (client: ReferralClient, clientIndex: number) => (
                      <Box
                        key={`${index}-${clientIndex}`}
                        sx={{
                          height: 100,
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
                          Referral Date: {client.referredDate}
                        </Typography>
                      </Box>
                    )
                  )}
                </AccordionDetails>
              </Accordion>
            )
          )}
        </Box>
      )}
    </Box>
  );
};

export default ReferralAgenciesReport;
