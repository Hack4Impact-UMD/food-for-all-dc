import React, { useState } from "react";
import "./Spreadsheet.css";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Paper,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";

const initialData = [
  {
    id: 1,
    firstname: "Yvonne",
    lastname: "Akins",
    quad: "SE",
    frequency: "1x_Monthly",
    tefap: "YES",
    diabetic: "NO",
    dialysis: "NO",
    startDate: "2010-03-29",
    adults: 1,
    children: 0,
    address: "3600 B Street",
    apt: "333",
    telephone: "202 583 8977",
    socialWorker: "Andrea McCarthy CAFB 526 5344 x307",
    income: 0,
    lat: 38.888107,
    lng: -76.951934,
  },
];

const fields = [
  { key: "firstname", label: "First Name", type: "text" },
  { key: "lastname", label: "Last Name", type: "text" },
  { key: "quad", label: "Quad", type: "text" },
  { key: "frequency", label: "Frequency", type: "text" },
  { key: "tefap", label: "TEFAP", type: "text" },
  { key: "diabetic", label: "Diabetic", type: "text" },
  { key: "dialysis", label: "Dialysis", type: "text" },
  { key: "startDate", label: "Start Date", type: "text" },
  { key: "adults", label: "Adults", type: "number" },
  { key: "children", label: "Children", type: "number" },
  { key: "address", label: "Address", type: "text" },
  { key: "apt", label: "Apt", type: "text" },
  { key: "telephone", label: "Telephone", type: "text" },
  { key: "socialWorker", label: "Social Worker Info", type: "text" },
  { key: "income", label: "Income", type: "number" },
  { key: "lat", label: "Lat", type: "number", readOnly: true },
  { key: "lng", label: "Lng", type: "number", readOnly: true },
];

const Spreadsheet: React.FC = () => {
  const [rows, setRows] = useState(initialData);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);

  const [newRow, setNewRow] = useState({
    firstname: "",
    lastname: "",
    quad: "",
    frequency: "",
    tefap: "",
    diabetic: "",
    dialysis: "",
    startDate: "",
    adults: 0,
    children: 0,
    address: "",
    apt: "",
    telephone: "",
    socialWorker: "",
    income: 0,
    lat: 0,
    lng: 0,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: string
  ) => {
    setNewRow({ ...newRow, [field]: e.target.value });
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    id: number,
    field: string
  ) => {
    const updatedRows = rows.map((row) =>
      row.id === id ? { ...row, [field]: e.target.value } : row
    );
    setRows(updatedRows);
  };

  const handleAddRow = () => {
    if (newRow.firstname && newRow.lastname && newRow.address) {
      setRows([...rows, { id: rows.length + 1, ...newRow }]);
      setNewRow({
        firstname: "",
        lastname: "",
        quad: "",
        frequency: "",
        tefap: "",
        diabetic: "",
        dialysis: "",
        startDate: "",
        adults: 0,
        children: 0,
        address: "",
        apt: "",
        telephone: "",
        socialWorker: "",
        income: 0,
        lat: 0,
        lng: 0,
      });
    }
  };

  const handleDeleteRow = (id: number) => {
    setRows(rows.filter((row) => row.id !== id));
  };

  const handleEditRow = (id: number) => {
    setEditingRowId(id);
  };

  const handleSaveRow = (id: number) => {
    setEditingRowId(null);
  };

  return (
    <Box className="box">
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {fields.map((field) => (
                <TableCell className="table-header" key={field.key}>{field.label}</TableCell>
              ))}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={editingRowId === row.id ? "editing-row" : ""}>
                {editingRowId === row.id
                  ? fields.map((field) => (
                      <TableCell key={field.key}>
                        <TextField
                          className="textfield"
                          type={field.type}
                          value={row[field.key as keyof typeof row]}
                          onChange={(e) => handleEditInputChange(e, row.id, field.key)}
                          variant="outlined"
                          size="small"
                          disabled={field.readOnly}
                        />
                      </TableCell>
                    ))
                  : fields.map((field) => (
                      <TableCell key={field.key}>
                        {row[field.key as keyof typeof row]}
                      </TableCell>
                    ))}
                <TableCell>
                  {editingRowId === row.id ? (
                    <IconButton className="iconbutton" onClick={() => handleSaveRow(row.id)}>
                      <SaveIcon />
                    </IconButton>
                  ) : (
                    <>
                      <IconButton className="iconbutton" onClick={() => handleEditRow(row.id)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton className="iconbutton" onClick={() => handleDeleteRow(row.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              {fields.map((field) => (
                <TableCell key={field.key}>
                  <TextField
                    className="textfield"
                    placeholder={field.label}
                    value={newRow[field.key as keyof typeof newRow]}
                    onChange={(e) => handleInputChange(e, field.key)}
                    type={field.type}
                    variant="outlined"
                    size="small"
                    disabled={field.readOnly}
                  />
                </TableCell>
              ))}
              <TableCell>
                <Button className="add-new-client" onClick={handleAddRow}>
                  Add New Client
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Spreadsheet;
