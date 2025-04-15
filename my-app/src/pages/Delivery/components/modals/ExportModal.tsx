import React from 'react';
import { Box, Typography } from "@mui/material";

interface ExportModalProps {
  type: "CSV" | "Doordash";
}

const ExportModal: React.FC<ExportModalProps> = ({
  type
}) => {
  return (
    <Box sx={{ alignItems: "center", textAlign: "center", padding: "1%" }}>
      <Typography variant="h5" sx={{ color: "#257e68", fontWeight: "bold" }}>
        Are you sure you want to export {type === "CSV" ? "drivers" : "Doordash"}?
      </Typography>
    </Box>
  );
};

export default ExportModal;