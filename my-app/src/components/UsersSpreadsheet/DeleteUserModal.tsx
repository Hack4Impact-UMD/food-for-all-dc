import DialogContentText from '@mui/material/DialogContentText';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";

type DeleteUserModalProps = {
  open: boolean;
  handleClose: () => void;
  handleDelete: () => void;
  userName?: string;
};

const DeleteUserModal = ({ open, handleClose, handleDelete, userName }: DeleteUserModalProps) => {

  const handleCloseDeleteConfirm = () => {
    handleClose();
  };

  const handleConfirmDelete = () => {
    handleDelete();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleCloseDeleteConfirm}
        
        // slotProps={{
        //   backdrop: {
        //     style: { backgroundColor: "rgba(0, 0, 0, 0.02)" }
        //   }
        // }}
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
          Confirm User Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-confirm-dialog-description">
            {`Are you sure you want to delete ${userName || 'this user'}? This action cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteConfirm} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete User
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default DeleteUserModal;