import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Table from "./Table";
import { SummaryData } from "../../types/reports-types";


interface ReportDataProps {
  data: SummaryData;
  loading: boolean;
}

export default function ReportTables({ data, loading }: ReportDataProps) {
  const [expandedPanels, setExpandedPanels] = useState<number[]>([]);
  const sectionNames = useMemo(() => Object.keys(data), [data]);

  const handleToggle = (index: number) => {
    setExpandedPanels((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const expandAllPanels = () => {
    setExpandedPanels(sectionNames.map((_, i) => i));
  };

  const collapseAllPanels = () => {
    setExpandedPanels([]);
  };

  //Convert the map shape into the array shape the table expects
  const toReportFieldsArray = (sectionName: string) => {
    const sectionMap = data[sectionName] || {};
    return Object.entries(sectionMap).map(([fieldName, obj]) => ({
      key: fieldName,
      value: obj.value,
      isFullRow: obj.isFullRow,
    }));
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        width: "90vw",
        backgroundColor: "var(--color-white)"color-white)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          gap: "5px",
          color: "var(--color-primary)",
          fontWeight: "bold",
          alignItems: "center",
          marginBottom: "10px",
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

      {sectionNames.map((name, index) => (
        <Accordion
          key={name}
          expanded={expandedPanels.includes(index)}
          onChange={() => handleToggle(index)}
          sx={{
            width: "100%",
            marginBottom: "8px",
            backgroundColor: "var(--color-white)"color-white)",
            border: "none",
            boxShadow: "none",
            borderRadius: "8px",
            overflow: "hidden",
            padding: "0px",
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: "var(--color-white)"color-white)" }} />}
            aria-controls={`panel${index}-content`}
            id={`panel${index}-header`}
            sx={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-white)"color-white)",
              marginBottom: "5px",
              borderTopLeftRadius: "8px",
              borderTopRightRadius: "8px",
            }}
          >
            <Typography variant="h6">{name}</Typography>
          </AccordionSummary>

          <AccordionDetails
            sx={{
              backgroundColor: "var(--color-white)"color-white)",
              color: "var(--color-black)"color-black)",
              padding: "0px",
            }}
          >
            {loading ? (
              <Box
                key={index}
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
              <Table data={toReportFieldsArray(name)} />
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </div>
  );
}
