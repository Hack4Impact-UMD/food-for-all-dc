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
  Menu,
  MenuItem,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import MoreVertIcon from "@mui/icons-material/MoreVert";

const initialData = [
  {
    id: 1,
    clientid: "52352362347",
    firstname: "Yvonne",
    lastname: "Akins",
    phone: "12312312",
    zipcode: "23423",
  },
];

const fields = [
  { key: "fullname", label: "Name", type: "text", compute: (data: { firstname: String; lastname: String; }) => `${data.lastname}, ${data.firstname}` },
  { key: "clientid", label: "Client ID", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "zipcode", label: "Zip Code", type: "text" }
];

const Spreadsheet: React.FC = () => {
  const [rows, setRows] = useState(initialData);
  const [newRow, setNewRow] = useState({
    firstname: "",
    lastname: "",
    clientid: "",
    phone: "",
    zipcode: ""
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

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
        clientid: "",
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
    setMenuAnchorEl(null); // Close the menu
  };

  const handleSaveRow = (id: number) => {
    setEditingRowId(null);
  };

  const handleRowClick = (clientid: string) => {
    navigate(`/user/${clientid}`);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: number) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedRowId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedRowId(null);
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
      clientid: "",
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
        placeholder="SEARCH"
        type="search"
        variant="outlined"
        size="small"
      />
      <Button
        variant="contained"
        color="primary"
        onClick={openModal}
        className="create-client"
      >
        + Create Client
      </Button>
      <TableContainer className="table-container" component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {fields.map((field) => (
                <TableCell className="table-header" key={field.key}><h2>{field.label}</h2></TableCell>
              ))}
              <TableCell className="table-header"></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id}  className={editingRowId === row.id ? "table-row editing-row" : "table-row"}>
                {fields.map((field) => (
                  <TableCell key={field.key}>
                    {editingRowId === row.id ? (
                      field.key === "fullname" ? (
                        <>
                          <TextField
                            placeholder="First Name"
                            value={row.firstname}
                            onChange={(e) => handleEditInputChange(e, row.id, "firstname")}
                            variant="outlined"
                            size="small"
                            style={{ marginRight: "8px" }}
                          />
                          <TextField
                            placeholder="Last Name"
                            value={row.lastname}
                            onChange={(e) => handleEditInputChange(e, row.id, "lastname")}
                            variant="outlined"
                            size="small"
                          />
                        </>
                      ) : (
                        <TextField
                          type={field.type}
                          value={row[field.key as keyof typeof row]}
                          onChange={(e) => handleEditInputChange(e, row.id, field.key)}
                          variant="outlined"
                          size="small"
                        />
                      )
                    ) : (
                      field.key === "fullname" ? (
                        field.compute ? field.compute(row) : `${row.firstname} ${row.lastname}`
                      ) : (
                        row[field.key as keyof typeof row]
                      )
                    )}
                  </TableCell>
                ))}
                <TableCell style={{ textAlign: 'right' }}>
                  {editingRowId === row.id ? (
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={() => handleSaveRow(row.id)}
                    >
                      <SaveIcon fontSize="small" /> Save
                    </Button>
                  ) : (
                    <IconButton onClick={(e) => handleMenuOpen(e, row.id)}>
                      <MoreVertIcon />
                    </IconButton>
                  )}
                  <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl) && selectedRowId === row.id}
                    onClose={handleMenuClose}
                  >
                    <MenuItem onClick={() => handleEditRow(row.id)}>
                      <EditIcon fontSize="small" /> Edit
                    </MenuItem>
                    <MenuItem onClick={() => handleDeleteRow(row.id)}>
                      <DeleteIcon fontSize="small" /> Delete
                    </MenuItem>
                  </Menu>
                </TableCell>
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
            placeholder="Client ID"
            value={newRow.clientid}
            onChange={(e) => handleInputChange(e, "clientid")}
            type="text"
            variant="outlined"
            size="small"
            fullWidth
            margin="dense"
          />
          <TextField
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
