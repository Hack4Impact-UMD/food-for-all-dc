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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
    phone: "12312312",
    zipcode: "23423",
  },
];

const fields = [
  { key: "fullname", label: "Full Name", type: "text", compute: (data: { firstname: String; lastname: String; }) => `${data.lastname}, ${data.firstname}` },
  { key: "uid", label: "UID", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "zipcode", label: "Zip Code", type: "text" }
];

const Spreadsheet: React.FC = () => {
  const [rows, setRows] = useState(initialData);
  const [newRow, setNewRow] = useState({
    firstname: "",
    lastname: "",
    uid: "",
    phone: "",
    zipcode: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        firstname: "",
        lastname: "",
        uid: "",
        phone: "",
        zipcode: ""
      });
      setIsModalOpen(false); // Close the modal after adding
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
    fields.some(field => {
      const fieldValue = field.compute ? field.compute(row) : row[field.key as keyof typeof row];
      return fieldValue && fieldValue.toString().toLowerCase().includes(searchQuery.toLowerCase());
    })
  );

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewRow({
      firstname: "",
      lastname: "",
      uid: "",
      phone: "",
      zipcode: ""
    });
  };

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
        style={{ marginBottom: 20 }}
      />
      <Button
        variant="contained"
        color="primary"
        onClick={openModal}
        className="create-client"
        style={{ marginBottom: 20 }}
      >
        + Create Client
      </Button>
      <TableContainer className="table-container" component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {fields.map((field) => (
                <TableCell className="table-header" key={field.key}>{field.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id} onClick={() => handleRowClick(row.uid)} className={editingRowId === row.id ? "table-row editing-row" : "table-row"}>
                {fields.map((field) => (
                  <TableCell key={field.key}>
                    {field.key === "fullname" ? (
                      field.compute ? field.compute(row) : `${row.firstname} ${row.lastname}`
                    ) : editingRowId === row.id ? (
                      <TextField
                        className="textfield"
                        type={field.type}
                        value={row[field.key as keyof typeof row]}
                        onChange={(e) => handleEditInputChange(e, row.id, field.key)}
                        variant="outlined"
                        size="small"
                      />
                    ) : (
                      row[field.key as keyof typeof row]
                    )}
                  </TableCell>
                ))}
                {/*
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
                </TableCell>*/}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Modal for adding a new client */}
      <Dialog open={isModalOpen} onClose={closeModal}>
        <DialogTitle>Create New Client</DialogTitle>
        <DialogContent>
          <TextField
            className="textfield"
            placeholder="First Name"
            value={newRow.firstname}
            onChange={(e) => handleInputChange(e, "firstname")}
            type="text"
            variant="outlined"
            size="small"
            fullWidth
            margin="dense"
          />
          <TextField
            className="textfield"
            placeholder="Last Name"
            value={newRow.lastname}
            onChange={(e) => handleInputChange(e, "lastname")}
            type="text"
            variant="outlined"
            size="small"
            fullWidth
            margin="dense"
          />
          <TextField
            className="textfield"
            placeholder="UID"
            value={newRow.uid}
            onChange={(e) => handleInputChange(e, "uid")}
            type="text"
            variant="outlined"
            size="small"
            fullWidth
            margin="dense"
          />
          <TextField
            className="textfield"
            placeholder="Phone"
            value={newRow.phone}
            onChange={(e) => handleInputChange(e, "phone")}
            type="text"
            variant="outlined"
            size="small"
            fullWidth
            margin="dense"
          />
          <TextField
            className="textfield"
            placeholder="Zip Code"
            value={newRow.zipcode}
            onChange={(e) => handleInputChange(e, "zipcode")}
            type="text"
            variant="outlined"
            size="small"
            fullWidth
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal} color="secondary">
            Cancel
          </Button>
          <Button onClick={handleAddRow} color="primary" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Spreadsheet;
