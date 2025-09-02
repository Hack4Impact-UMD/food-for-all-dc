import React from "react";
import { Menu, MenuItem } from "@mui/material";

interface ExportMenuProps {
  anchorEl: null | HTMLElement;
  step: number;
  handleClose: () => void;
  parentChoice: string;
  handleParentSelect: (choice: string) => void;
  handleFinalAction: (action: string) => void;
}

const ExportMenu: React.FC<ExportMenuProps> = ({
  anchorEl,
  step,
  handleClose,
  parentChoice,
  handleParentSelect,
  handleFinalAction,
}) => {
  return (
    <>
      {/* Step 1: Main Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && step === 1}
        onClose={handleClose}
        MenuListProps={{ sx: { minWidth: 140 } }}
      >
        <MenuItem onClick={() => handleParentSelect("Route")}>Route</MenuItem>
        <MenuItem onClick={() => handleParentSelect("Doordash")}>Doordash</MenuItem>
      </Menu>

      {/* Step 2: Submenu based on choice */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl) && step === 2}
        onClose={handleClose}
        MenuListProps={{ sx: { minWidth: 140 } }}
      >
        {parentChoice === "Route" && (
          <>
            <MenuItem onClick={() => handleFinalAction("Email Drivers")}>Email Drivers</MenuItem>
            <MenuItem onClick={() => handleFinalAction("Download Drivers")}>
              Download Drivers
            </MenuItem>
          </>
        )}
        {parentChoice === "Doordash" && (
          <MenuItem onClick={() => handleFinalAction("Download Doordash")}>
            Download Doordash
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default ExportMenu;
