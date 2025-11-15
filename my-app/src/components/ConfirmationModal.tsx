import React from "react";
import { Button } from "@mui/material";
import { Modal } from "./common";

/**
 * Confirmation modal for destructive actions
 *
 * @example
 * <ConfirmationModal
 *   open={showDeleteModal}
 *   onClose={() => setShowDeleteModal(false)}
 *   onConfirm={handleDelete}
 *   title="Delete Client"
 *   message="Are you sure you want to delete this client? This action cannot be undone."
 *   confirmText="Delete"
 *   confirmColor="error"
 * />
 */
interface ConfirmationModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Function to call when modal should close */
  onClose: () => void;
  /** Function to call when user confirms */
  onConfirm: () => void;
  /** Modal title */
  title: string;
  /** Confirmation message */
  message: string;
  /** Text for confirm button */
  confirmText?: string;
  /** Text for cancel button */
  cancelText?: string;
  /** Color scheme for confirm button */
  confirmColor?: "primary" | "secondary" | "error" | "warning";
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "primary",
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const actions = (
    <>
      <Button onClick={onClose} color="inherit">
        {cancelText}
      </Button>
      <Button onClick={handleConfirm} color={confirmColor} variant="contained" autoFocus>
        {confirmText}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={title} actions={actions} maxWidth="sm">
      <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
    </Modal>
  );
};

export default ConfirmationModal;
