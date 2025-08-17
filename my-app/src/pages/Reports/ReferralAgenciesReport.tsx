import React, { useState } from "react";
import ReportHeader from "./ReportHeader";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Spreadsheet from "../../components/Spreadsheet/Spreadsheet";

const ReferralAgenciesReport: React.FC = () => {
  const [expandedPanels, setExpandedPanels] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
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

  interface Agency { 
    name: string; 
    lastDelivery: string 
  }

  const agencies: { [key: string]: Agency[] } = {
    "Peter Sage - Food For All DC": [
      {name: "Margot Robbie", lastDelivery: "7/07/2025"}
    ],
    "Jimmy Stevens - Catholic Charities": [
      {name: "Chris Hemsworth", lastDelivery: "7/07/25"}
    ],
    "Buther Bailey - Google": [
      {name: "Ryan Gosling", lastDelivery: "7/07/25"}
    ],
    "Versace Donatella - Meta": [
      {name: "Emma Stone", lastDelivery: "7/07/25"}
    ],
    "Charolotte Altchison - Walmart": [
      {name: "Pedro Pascal", lastDelivery: "7/07/25"}
    ],
    "Mr. Bean - Pinterest": [
      {name: "Chris Evans", lastDelivery: "7/07/25"}
    ]
  };

  const agencyNames = Object.keys(agencies);

  const handleToggle = (index: number) => {
    setExpandedPanels((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const expandAllPanels = () => {
    setExpandedPanels(agencyNames.map((_, i) => i));
  };

  const collapseAllPanels = () => {
    setExpandedPanels([]);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh", 
      }}
    >
      <ReportHeader 
        startDate={startDate} 
        endDate={endDate} 
        setStartDate={setStartDate} 
        setEndDate={setEndDate}
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
                agencies[name].map((agency, agencyIndex) => (
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
                    <Typography sx={{
                      color: "var(--color-primary)", 
                      fontWeight: "bold", 
                      textDecoration: "underline", 
                      fontSize: "17px"
                    }}>
                      {agency.name}
                    </Typography>
                    <Typography sx={{ margin: 0 }}>
                      Last Delivered: {agency.lastDelivery}
                    </Typography>
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