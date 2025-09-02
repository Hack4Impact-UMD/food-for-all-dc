import React from "react";
import {
  Checkbox,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Box,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
// Since the types directory and file might not exist in the file system yet, let's use
// a direct import from the parent component
// Import types directly since relative import isn't working
export interface RowData {
  id: string;
  clientid: string;
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  tags?: string[];
  ward?: string;
  clusterID?: string;
  deliveryDetails: {
    deliveryInstructions: string;
    dietaryRestrictions: {
      foodAllergens: string[];
      halal: boolean;
      kidneyFriendly: boolean;
      lowSodium: boolean;
      lowSugar: boolean;
      microwaveOnly: boolean;
      noCookingEquipment: boolean;
      other: string[];
      softFood: boolean;
      vegan: boolean;
      vegetarian: boolean;
    };
  };
  ethnicity?: string;
  language?: string;
  dob?: string;
  gender?: string;
  zipCode?: string;
  streetName?: string;
  [key: string]: any;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface Cluster {
  docId: string;
  id: number;
  driver: any;
  time: string;
  deliveries: any[];
}

export interface CustomColumn {
  id: string;
  label: string;
  propertyKey: string; // Changed from keyof RowData | "none" to string to fix type error
}

// Type for field definitions
export type Field =
  | {
      key: "checkbox";
      label: "";
      type: "checkbox";
      compute?: never;
      width: string;
    }
  | {
      key: "fullname";
      label: "Client";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: string;
      label: string;
      type: string;
      compute?: never;
      width: string;
    }
  | {
      key: "tags";
      label: "Tags";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: "assignedDriver";
      label: "Driver";
      type: "text";
      compute: (data: RowData, clusters: Cluster[], drivers: Driver[]) => string;
      width: string;
    }
  | {
      key: "assignedTime";
      label: "Time";
      type: "text";
      compute: (data: RowData, clusters: Cluster[]) => string;
      width: string;
    }
  | {
      key: "deliveryDetails.deliveryInstructions";
      label: "Instructions";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    }
  | {
      key: "phone";
      label: "Phone Number";
      type: "text";
      compute: (data: RowData) => string;
      width: string;
    };

// Type guard to check if a field is a regular field
export const isRegularField = (field: Field): boolean => {
  return (
    field.key !== "fullname" &&
    field.key !== "tags" &&
    field.key !== "assignedDriver" &&
    field.key !== "assignedTime" &&
    field.key !== "phone" &&
    field.key !== "deliveryDetails.deliveryInstructions"
  );
};

interface DeliveryTableProps {
  fields: Field[];
  visibleRows: RowData[];
  selectedRows: Set<string>;
  handleCheckboxChange: (id: string) => void;
  clusters: Cluster[];
  drivers: Driver[];
  customColumns: CustomColumn[];
  handleAddCustomColumn: () => void;
  handleCustomHeaderChange: (event: SelectChangeEvent<string>, columnId: string) => void;
  handleRemoveCustomColumn: (columnId: string) => void;
}

const DeliveryTable: React.FC<DeliveryTableProps> = ({
  fields,
  visibleRows,
  selectedRows,
  handleCheckboxChange,
  clusters,
  drivers,
  customColumns,
  handleAddCustomColumn,
  handleCustomHeaderChange,
  handleRemoveCustomColumn,
}) => {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        margin: "0 auto",
        paddingBottom: "2vh",
        width: "100%",
        maxHeight: "none",
      }}
    >
      <TableContainer
        component={Paper}
        sx={{
          maxHeight: "none",
          height: "auto",
          width: "100%",
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {fields.map((field) => (
                <TableCell
                  className="table-header"
                  key={field.key}
                  style={{ width: field.width }}
                  sx={{ textAlign: "center" }}
                >
                  <h2 style={{ fontWeight: "bold" }}>{field.label}</h2>
                </TableCell>
              ))}
              {/* Adding custom columns */}
              {/*  Headers for custom columns */}
              {customColumns.map((col) => (
                <TableCell className="table-header" key={col.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Select
                      value={col.propertyKey}
                      onChange={(event: SelectChangeEvent<string>) =>
                        handleCustomHeaderChange(event, col.id)
                      }
                      variant="outlined"
                      displayEmpty
                      sx={{ minWidth: 120, color: "#257e68" }}
                    >
                      <MenuItem value="ethnicity">Ethnicity</MenuItem>
                      <MenuItem value="language">Language</MenuItem>
                      <MenuItem value="dob">DOB</MenuItem>
                      <MenuItem value="gender">Gender</MenuItem>
                      <MenuItem value="zipCode">Zip Code</MenuItem>
                      <MenuItem value="streetName">Street Name</MenuItem>
                      <MenuItem value="ward">Ward</MenuItem>
                      <MenuItem value="none">None</MenuItem>
                    </Select>
                    {/*Add Remove Button*/}
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveCustomColumn(col.id)} // Call remove handler
                      aria-label={`Remove ${col.label || "custom"} column`}
                      title={`Remove ${col.label || "custom"} column`} // Tooltip for accessibility
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              ))}

              {/* Add button cell */}
              <TableCell className="table-header" style={{ textAlign: "right" }}>
                <IconButton
                  onClick={handleAddCustomColumn}
                  color="primary"
                  aria-label="add custom column"
                >
                  <AddIcon sx={{ color: "#257e68" }} />
                </IconButton>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id} className={"table-row"}>
                {fields.map((field) => (
                  <TableCell key={field.key} style={{}}>
                    {field.key === "checkbox" ? (
                      <Checkbox
                        checked={selectedRows.has(row.id)}
                        onChange={() => handleCheckboxChange(row.id)}
                        sx={{
                          color: "gray",
                          "&.Mui-checked": {
                            color: "#257E68",
                          },
                          "&:hover": {
                            backgroundColor: "rgba(37, 126, 104, 0.1)",
                          },
                        }}
                      />
                    ) : field.key === "fullname" && field.compute ? (
                      field.compute(row)
                    ) : field.key === "tags" && field.compute ? (
                      field.compute(row)
                    ) : field.key === "assignedDriver" && field.compute ? (
                      <div
                        style={{
                          // Remove white bg from here
                          backgroundColor: "",
                          minHeight: "30px", // Ensures a consistent height
                          width: "95%",
                          padding: "5px",
                          display: "flex",
                          fontSize: "13px",
                          textAlign: "center",
                          alignItems: "center",
                          justifyContent: "center",
                          whiteSpace: "pre-wrap",
                          overflow: "auto",
                        }}
                      >
                        {field.compute(row, clusters, drivers)}
                      </div>
                    ) : field.key === "assignedTime" && field.compute ? (
                      <div
                        style={{
                          // Remove white bg from here
                          backgroundColor: "",
                          minHeight: "30px", // Ensures a consistent height
                          width: "95%",
                          padding: "5px",
                          display: "flex",
                          fontSize: "13px",
                          textAlign: "center",
                          alignItems: "center",
                          justifyContent: "center",
                          whiteSpace: "pre-wrap",
                          overflow: "auto",
                        }}
                      >
                        {field.compute(row, clusters)}
                      </div>
                    ) : field.key === "phone" && field.compute ? (
                      field.compute(row)
                    ) : field.key === "deliveryDetails.deliveryInstructions" && field.compute ? (
                      <div
                        style={{
                          // Remove black bg here.
                          backgroundColor: "",
                          minHeight: "70px",
                          padding: "10px",
                          display: "flex",
                          alignItems: "left",
                          whiteSpace: "pre-wrap",
                          overflow: "auto",
                          color: "black",
                        }}
                      >
                        {field.compute(row)}
                      </div>
                    ) : isRegularField(field) ? (
                      row[field.key]
                    ) : null}
                  </TableCell>
                ))}

                {customColumns.map((col) => (
                  <TableCell key={col.id}>
                    {col.propertyKey !== "none"
                      ? (row[col.propertyKey as keyof RowData]?.toString() ?? "N/A")
                      : "N/A"}
                  </TableCell>
                ))}

                <TableCell></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default DeliveryTable;
