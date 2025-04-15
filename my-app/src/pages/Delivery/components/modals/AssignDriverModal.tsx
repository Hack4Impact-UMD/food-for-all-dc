import React from 'react';
import { Box, Autocomplete, TextField, Paper } from "@mui/material";
import { Driver, DriverOption } from "../../types/deliveryTypes";

interface AssignDriverModalProps {
  drivers: Driver[];
  driverSearchQuery: string;
  setDriverSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setDriver: React.Dispatch<React.SetStateAction<Driver | null | undefined>>;
  setShowEditDriverList: React.Dispatch<React.SetStateAction<boolean>>;
}

const AssignDriverModal: React.FC<AssignDriverModalProps> = ({
  drivers,
  driverSearchQuery,
  setDriverSearchQuery,
  setDriver,
  setShowEditDriverList
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: "300px",
      }}
    >
      <Autocomplete
        freeSolo
        options={[
          {
            id: "edit_list",
            name: "Edit Driver List >",
            phone: "",
            email: "",
          } as DriverOption,
          ...drivers,
        ]}
        getOptionLabel={(option) => {
          if (typeof option === "string") return option;
          return option.name;
        }}
        onChange={(event, value) => {
          if (value) {
            if (typeof value !== "string") {
              if (value.id === "edit_list") {
                setShowEditDriverList(true);
                setDriver(null); // Clear selected driver when opening edit list
              } else {
                setDriver(value as Driver);
              }
            }
          } else {
            setDriver(null); // Clear selected driver when no value
          }
        }}
        isOptionEqualToValue={(option, value) => {
          // Prevent "Edit Driver List" from being selected as a value
          if (option.id === "edit_list") return false;
          return option.id === value.id;
        }}
        onInputChange={(event, newValue) => setDriverSearchQuery(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            variant="outlined"
            placeholder="Search drivers..."
            value={driverSearchQuery}
            onChange={(e) => setDriverSearchQuery(e.target.value)}
          />
        )}
        renderOption={(props, option) => (
          <li
            {...props}
            style={{
              color: option.id === "edit_list" ? "#257E68" : "inherit",
              fontWeight: option.id === "edit_list" ? "bold" : "normal",
            }}
          >
            {option.name}
          </li>
        )}
        PaperComponent={({ children }) => <Paper elevation={3}>{children}</Paper>}
        noOptionsText="No drivers found"
      />
    </Box>
  );
};

export default AssignDriverModal;