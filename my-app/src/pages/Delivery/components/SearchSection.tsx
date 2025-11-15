import React from 'react';
import { Filter, Search } from "lucide-react";
import { Box, Button } from "@mui/material";

interface SearchSectionProps {
  searchQuery: string;
  handleSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedRows: Set<string>;
  setPopupMode: (mode: string) => void;
  handleButtonClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const SearchSection: React.FC<SearchSectionProps> = ({ 
  searchQuery, 
  handleSearchChange,
  selectedRows,
  setPopupMode,
  handleButtonClick
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        zIndex: 8,
        backgroundColor: "var(--color-background-main)",
        padding: "16px 0",
        top: "472px",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Box sx={{ position: "relative", width: "100%" }}>
          <Search
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-medium-alt)",
              zIndex: 1,
            }}
            size={20}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder='Search (e.g., "ward: 5" "driver: smith" "cluster: A")'
            style={{
              width: "100%",
              height: "60px",
              backgroundColor: "var(--color-background-gray)",
              border: "none",
              borderRadius: "30px",
              padding: "0 48px",
              fontSize: "16px",
              color: "var(--color-text-dark)",
              boxSizing: "border-box",
            }}
          />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", width: "100%", gap: "2%" }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => searchQuery !== "" && handleSearchChange({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>)}
              className="view-all"
              sx={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "5px",
                width: "10%",
              }}
            >
              Driver List
            </Button>
            <Button
              variant="contained"
              disabled={selectedRows.size <= 0}
              onClick={() => {
                setPopupMode("Driver");
              }}
              className="view-all"
              sx={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "5px",
                width: "10%",
                backgroundColor: (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
              }}
            >
              Assign Driver
            </Button>
            <Button
              variant="contained"
              color="secondary"
              className="view-all"
              onClick={() => {
                setPopupMode("Time");
              }}
              disabled={selectedRows.size <= 0}
              sx={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "5px",
                width: "10%",
                backgroundColor: (selectedRows.size <= 0 ? "gray" : "#257E68") + " !important",
              }}
            >
              Assign Time
            </Button>
            <Button
              variant="contained"
              color="secondary"
              className="view-all"
              onClick={handleButtonClick}
              sx={{
                whiteSpace: "nowrap",
                padding: "0% 2%",
                borderRadius: "5px",
                width: "10%",
                backgroundColor: "var(--color-primary)",
                marginLeft: "auto",
              }}
            >
              Export
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SearchSection;