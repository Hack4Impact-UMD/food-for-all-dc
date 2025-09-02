import React from "react";
import ConfirmationModal from "../ConfirmationModal";

/**
 * Modal for confirming client deletion
 */
interface DeleteClientModalProps {
  /** Function to call when menu should close */
  handleMenuClose: () => void;
  /** Function to call when row should be deleted */
  handleDeleteRow: (id: string) => Promise<void>;
  /** Whether the modal is open */
  open: boolean;
  /** Function to set modal open state */
  setOpen: (open: boolean) => void;
  /** ID of the client to delete */
  id: string;
}

const DeleteClientModal: React.FC<DeleteClientModalProps> = ({
  handleMenuClose,
  handleDeleteRow,
  open,
  setOpen,
  id,
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
      message="Are you sure you want to delete this client? This action cannot be undone."
      confirmText="Delete"
      confirmColor="error"
    />
  );
};

export default DeleteClientModal;
