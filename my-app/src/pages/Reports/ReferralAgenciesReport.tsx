import React, { useEffect, useState } from "react";
import ReportHeader from "./ReportHeader";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Spreadsheet from "../../components/Spreadsheet/Spreadsheet";
import { db } from "../../auth/firebaseConfig";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import {Time, TimeUtils} from "../../utils/timeUtils";
import { CaseWorker } from "../../types";
import { useNavigate } from "react-router-dom";

interface ReferralClient { 
  id: string;
  name: string; 
  lastDelivery: string 
}

const ReferralAgenciesReport: React.FC = () => {
  const navigate = useNavigate()
  const [expandedPanels, setExpandedPanels] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [agencies, setAgencies] = useState<any>({})
  const [agencyNames, setAgencyNames] = useState<string[]>([])
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

  //Get caseworkers
  const getCaseWorkers = async () => {
    try {
      const caseworkerRef = collection(db, "new_case_workers");

      // Convert Date | null to DateTime, or use a default fallback if null
      const startDateTime = startDate ? TimeUtils.fromJSDate(startDate).startOf('day') : TimeUtils.fromJSDate(new Date(0));
      const endDateTime = endDate ? TimeUtils.fromJSDate(endDate).endOf('day') : TimeUtils.fromJSDate(new Date(8640000000000000));
      
      const q = query(
        caseworkerRef,
        where("createdAt", ">=", Time.Firebase.toTimestamp(startDateTime)),
        limit(10)
      );

      const snapshot = await getDocs(q);
      const caseWorkers: CaseWorker[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          organization: data.organization,
          phone: data.phone,
          email: data.email,
        };
      });
      return caseWorkers
    } catch (e) {
      console.error(e)
      return []
    }
  }

  //Get caseworkers
  const getClientsForCaseworker = async (caseworkerId: string) => {
    const clientRef = collection(db, "clients");

    // Convert Date | null to DateTime, or use a default fallback if null
    // const startDateTime = startDate ? TimeUtils.fromJSDate(startDate).startOf('day') : TimeUtils.fromJSDate(new Date(0));
    // const endDateTime = endDate ? TimeUtils.fromJSDate(endDate).endOf('day') : TimeUtils.fromJSDate(new Date(8640000000000000));
    const q = query(
      clientRef,
      where("referralEntity.id", "==", caseworkerId),
      limit(10)
    );

    const snapshot = await getDocs(q);
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return clients;
  }

  // let agencies: { [key: string]: ReferralClient[] } = {};

  const generateReport = async () => {
    const caseworkers = await getCaseWorkers();
    const report: { [key: string]: ReferralClient[] }  = {}
    let counter = 0
    const newAgencies: any = {}
    for (const caseworker of caseworkers) {
      console.log(caseworker.id)
      console.log(counter)
      counter += 1
      const title = `${caseworker.name} - ${caseworker.organization} - (${caseworker.phone},  ${caseworker.email})`;
      const clients = await getClientsForCaseworker(caseworker.id);
      if (clients.length > 0) {
        newAgencies[title] = []
        clients.forEach((client: any)=>{
          newAgencies[title].push({name: `${client.firstName} ${client.lastName}`, id: client.id, lastDelivery: client.lastDeliveryDate})
        })
      }
    }
    setAgencies(newAgencies)
  }

  useEffect(()=>{
    setAgencyNames(Object.keys(agencies));
  },[agencies])

  const handleToggle = (index: number) => {
    setExpandedPanels((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const expandAllPanels = () => {
    setExpandedPanels(agencyNames.map((_: any, i: any) => i));
  };

  const collapseAllPanels = () => {
    setExpandedPanels([]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "90vh", 
      }}
    >
      <ReportHeader 
        startDate={startDate} 
        endDate={endDate} 
        setStartDate={setStartDate} 
        setEndDate={setEndDate}
        generateReport = {generateReport}
      />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          width: "90vw",
          backgroundColor: "white"
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: "5px",
            color: "var(--color-primary)",
            fontWeight: "bold",
            alignItems: "center",
            marginBottom: "10px"
          }}
        >
          <Typography
            onClick={expandAllPanels}
            sx={{
              fontWeight: "bold",
              cursor: "pointer",
              "&:hover": {
                opacity: 0.7
              }
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
              "&:hover": {
                opacity: 0.9
              }
            }}
          >
            Collapse All
          </Typography>
        </Box>
        {agencyNames.map((name, index) => (
          <Accordion
            key={name}
            expanded={expandedPanels.includes(index)}
            onChange={() => handleToggle(index)}
            sx={{
              width: "100%",
              marginBottom: "8px",
              backgroundColor: "white",
              border: "none",         
              boxShadow: "none",       
              borderRadius: "8px",   
              overflow: "hidden",
              padding: "0px"
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: "white" }} />}
              aria-controls={`panel${index}-content`}
              id={`panel${index}-header`}
              sx={{
                backgroundColor: "var(--color-primary)",
                color: "white",
                marginBottom: "5px",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
              }}
            >
              <Typography variant="h6">{name}</Typography>
            </AccordionSummary>
            <AccordionDetails
              sx={{
                backgroundColor: "white",
                color: "black",
                padding: "0px"
              }}
            >
              {loading ? (
                <Box
                  key={`loading-${index}`}
                  sx={{
                    height: "100px",
                    backgroundColor: "#f0f0f0ff",
                    display: "flex",       
                    alignItems: "center",     
                    justifyContent: "center", 
                  }}
                >
                  <p>Select a timeframe and click &quot;Generate&quot; to see results</p>
                </Box>
              ) : (
                agencies[name].map((agency: any, agencyIndex: any) => (
                  <Box
                    key={`${index}-${agencyIndex}`}
                    sx={{
                      height: "100px",
                      backgroundColor: "#f0f0f0ff",
                      marginBottom: "10px",
                      width: "100%",
                      display: "flex",
                      padding: "20px",
                      justifyContent: "center",
                      flexDirection: "column"
                    }}
                  >
                    <>
                      <Typography
                        sx={{
                          color: "var(--color-primary)", 
                          fontWeight: "bold", 
                          textDecoration: "underline", 
                          fontSize: "17px"
                        }}
                        onClick={() => { navigate(`/profile/${agency.id}`); }}
                        style={{ cursor: "pointer" }}
                      >
                        {agency.name}
                      </Typography>
                      <Typography sx={{ margin: 0 }}>
                        Last Delivered: {agency.lastDelivery}
                      </Typography>
                    </>
                  </Box>
                ))
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </div>
    </div>
  );
};

export default ReferralAgenciesReport;