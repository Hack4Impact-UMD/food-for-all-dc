import DialogContentText from '@mui/material/DialogContentText';
import {
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";

import { styled } from '@mui/material/styles';

const TransparentDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  '& .MuiDialog-paper': {
    boxShadow: 'none',
    backgroundColor: 'white',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '8px'
  },
  '& .MuiDialog-container': {
    backdropFilter: 'none',
    backgroundColor: 'transparent'
  }
}));

type DeleteClientModalProps = {
  handleMenuClose: () => void;
  handleDeleteRow: (id: string) => Promise<void>;
  open: boolean;
  setOpen: (open: boolean) => void;
  id: string;
};

const DeleteClientModal = ({ handleMenuClose, handleDeleteRow, open, setOpen ,id }: DeleteClientModalProps) => {


  const handleCloseDeleteConfirm = () => {
    setOpen(false);    // Close the dialog
    handleMenuClose();
  };

  const handleConfirmDelete = () => {
    if (id) {
      console.log("DELETED")
      handleDeleteRow(id); 
    }
    handleCloseDeleteConfirm();    
  };


  return (
    <> 
      <Dialog
        open={open}
        onClose={handleCloseDeleteConfirm} // Close if clicking outside
        
        slotProps={{
          backdrop: {
            style: { backgroundColor: "rgba(0, 0, 0, 0.02)" }
          }
        }}
        sx={{
          '& .MuiDialog-paper': {
            boxShadow: 'none !important',
            overflow: 'visible',
            background: 'white',
            borderTop: '1px solid rgba(0, 0, 0, 0.12)',
            borderRadius: '8px'
          }
        }}
      
      >
        <DialogTitle id="delete-confirm-dialog-title">
          Confirm Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-confirm-dialog-description">
            Are you sure you want to delete this client? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteConfirm} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default DeleteClientModal;