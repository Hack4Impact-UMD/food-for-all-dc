import React from "react";
import { Box, Typography } from "@mui/material";

const DietaryRestrictionsLegend: React.FC = () => {
  // Color definitions from Spreadsheet.tsx
  const colorTypes = [
    {
      name: "General Dietary Restrictions",
      color: "var(--color-background-green-light)",
      border: "#257e68", // matches chip text color
    },
    {
      name: "Food Allergies",
      color: "var(--color-allergy-background)",
      border: "#c62828", // matches chip text color
    },
    {
      name: "Other Restrictions",
      color: "var(--color-other-restriction-background)",
      border: "#6c3483", // matches chip text color
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 2,
        mb: 0,
        mt: 0,
        p: 0,
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: "var(--color-primary)",
          fontSize: "0.735rem",
        }}
      >
        Dietary Restrictions:
      </Typography>

      {colorTypes.map((type, index) => (
        <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            sx={{
              width: 13.44,
              height: 13.44,
              backgroundColor: type.color,
              border: `0.25px solid ${type.border}`,
              borderRadius: 0.5,
            }}
          />
          <Typography
            variant="body2"
            sx={{
              fontSize: "0.672rem",
              color: "var(--color-text-medium-alt2)",
            }}
          >
            {type.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default DietaryRestrictionsLegend;
