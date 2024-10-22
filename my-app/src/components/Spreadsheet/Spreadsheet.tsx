import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    uid: "52352362347",
    firstname: "Yvonne",
    lastname: "Akins",
    phone: "",
    zipcode: "",
  },
];

const fields = [
  { key: "uid", label: "UID", type: "text"},
  { key: "firstname", label: "First Name", type: "text" },
  { key: "lastname", label: "Last Name", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "zipcode", label: "Zip Code", type: "text"}
];

const Spreadsheet: React.FC = () => {
  const [rows, setRows] = useState(initialData);
  const [newRow, setNewRow] = useState({
    uid: "",
    firstname: "",
    lastname: "",
    phone: "",
    zipcode: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: string
  ) => {
    setNewRow({ ...newRow, [field]: e.target.value });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
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
    if (newRow.firstname && newRow.lastname) {
      setRows([...rows, { id: rows.length + 1, ...newRow }]);
      setNewRow({
        uid: "",
        firstname: "",
        lastname: "",
        phone: "",
        zipcode: ""
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

  const handleRowClick = (uid: string) => {
    navigate(`/user/${uid}`);
  };

  const visibleRows = rows.filter(row => 
    fields.some(field => row[field.key as keyof typeof row].toString().toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Box className="box">
      <TextField
        className="search-bar"
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder="Search"
        type="search"
        variant="outlined"
        size="small"
        style={{ marginBottom: 20, width: '100%' }}
      />
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
            {visibleRows.map((row) => (
              <TableRow key={row.id} onClick={() => handleRowClick(row.uid)} className={editingRowId === row.id ? "table-row editing-row" : "table-row"}>
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
                    <IconButton onClick={() => handleSaveRow(row.id)}>
                      <SaveIcon />
                    </IconButton>
                  ) : (
                    <>
                      <IconButton onClick={() => handleEditRow(row.id)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteRow(row.id)}>
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
