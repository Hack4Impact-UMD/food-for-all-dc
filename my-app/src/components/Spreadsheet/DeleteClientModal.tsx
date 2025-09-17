import React from 'react';
import ConfirmationModal from '../ConfirmationModal';

/**
 * Modal for confirming client deletion
 */
interface DeleteClientModalProps {
  handleMenuClose: () => void;
  handleDeleteRow: (id: string) => Promise<void>;
  open: boolean;
  setOpen: (open: boolean) => void;
  id: string;
  name?: string;
}

const DeleteClientModal: React.FC<DeleteClientModalProps> = ({ 
  handleMenuClose, 
  handleDeleteRow, 
  open, 
  setOpen, 
  id, 
  name 
}) => {
  const handleClose = () => {
    setOpen(false);
    handleMenuClose();
  };

  const handleConfirm = async () => {
    if (id) {
      console.log("DELETED");
      await handleDeleteRow(id);
    }
  };

  return (
    <ConfirmationModal
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title="Confirm Deletion"
      message={`Are you sure you want to delete this client${name ? ` (${name})` : ''}? This action cannot be undone.`}
      confirmText="Delete"
      confirmColor="error"
    />
  );
};

export default DeleteClientModal;