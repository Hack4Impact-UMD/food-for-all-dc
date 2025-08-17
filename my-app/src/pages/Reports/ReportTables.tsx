import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import { useState } from "react";
import Table from "./Table";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ReportField } from "../../types/reports-types";

interface ReportDataProps {
    data: { [section: string]: ReportField[] },
    loading: boolean
}

export default function ReportTables({data, loading}: ReportDataProps) {
    const [expandedPanels, setExpandedPanels] = useState<number[]>([]);
    const sectionNames = Object.keys(data);
    const handleToggle = (index: number) => {
        setExpandedPanels((prev) =>
            prev.includes(index)
            ? prev.filter((i) => i !== index)
            : [...prev, index]
        );
    };

    const expandAllPanels = () => {
        setExpandedPanels(sectionNames.map((_, i) => i));
    };

    const collapseAllPanels = () => {
        setExpandedPanels([]);
    };
    return (
        <>
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
                {sectionNames.map((name, index) => (
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
                    {loading ? 
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
                    : <Table data={data[name]} />}
                    </AccordionDetails>
                </Accordion>
                ))}
            </div>
        </>
    )
}