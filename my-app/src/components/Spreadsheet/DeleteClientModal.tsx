import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

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
        aria-labelledby="delete-confirm-dialog-title"
        aria-describedby="delete-confirm-dialog-description"
      
        BackdropProps={{sx:{backgroundColor: 'rgba(0, 0, 0, 0.07)',
          
        }}}
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