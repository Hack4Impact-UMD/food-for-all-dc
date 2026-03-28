import React from "react";
import ConfirmationModal from "../ConfirmationModal";

type DeleteUserModalProps = {
  open: boolean;
  handleClose: () => void;
  handleDelete: () => void;
  userName?: string;
  loading?: boolean;
};

const DeleteUserModal = ({
  open,
  handleClose,
  handleDelete,
  userName,
  loading,
}: DeleteUserModalProps) => {
  return (
    <ConfirmationModal
      open={open}
      onClose={handleClose}
      onConfirm={handleDelete}
      title="Confirm User Deletion"
      message={`Are you sure you want to delete ${userName || "this user"}? This action cannot be undone.`}
      confirmText="Delete User"
      confirmColor="error"
      loading={loading}
    />
  );
};

export default DeleteUserModal;
