import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

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
  onConfirm: () => void | Promise<void>;
  /** Modal title */
  title: string;
  /** Confirmation message */
  message: React.ReactNode;
  /** Text for confirm button */
  confirmText?: string;
  /** Text for cancel button */
  cancelText?: string;
  /** Color scheme for confirm button */
  confirmColor?: "primary" | "secondary" | "error" | "warning";
  /** Whether action is in progress */
  loading?: boolean;
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
  loading = false,
}) => {
  const [isInternalSubmitting, setIsInternalSubmitting] = useState(false);
  const isBusy = loading || isInternalSubmitting;

  useEffect(() => {
    if (!open) {
      setIsInternalSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (isBusy) {
      return;
    }

    setIsInternalSubmitting(true);
    try {
      await Promise.resolve(onConfirm());
      onClose();
    } finally {
      setIsInternalSubmitting(false);
    }
  };

  const isDestructive = confirmColor === "error";
  const iconColor = isDestructive
    ? "var(--color-error-text)"
    : confirmColor === "warning"
      ? "var(--color-warning-text)"
      : "var(--color-primary)";
  const iconBackground = isDestructive
    ? "var(--color-error-background)"
    : confirmColor === "warning"
      ? "var(--color-warning-background)"
      : "var(--color-background-green-light)";
  const confirmBg = isDestructive ? "var(--color-error-text)" : "var(--color-primary)";
  const confirmBgHover = isDestructive
    ? "var(--color-error-text-alt)"
    : "var(--color-primary-hover-alt)";
  const messageStyles = {
    color: "var(--color-text-medium-alt)",
    lineHeight: 1.55,
  };

  const actions = (
    <>
      <Button
        onClick={onClose}
        disabled={isBusy}
        sx={{
          borderRadius: "10px",
          px: 2.5,
          color: "var(--color-text-medium-alt)",
          border: "1px solid var(--color-border-medium)",
          backgroundColor: "var(--color-white)",
          textTransform: "none",
          fontWeight: 600,
          "&:hover": {
            backgroundColor: "var(--color-background-lighter)",
            borderColor: "var(--color-divider)",
          },
        }}
      >
        {cancelText}
      </Button>
      <Button
        onClick={handleConfirm}
        variant="contained"
        autoFocus
        disabled={isBusy}
        startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : null}
        sx={{
          borderRadius: "10px",
          px: 2.5,
          textTransform: "none",
          fontWeight: 700,
          color: "var(--color-white) !important",
          backgroundColor: `${confirmBg} !important`,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
            backgroundColor: `${confirmBgHover} !important`,
          },
        }}
      >
        {confirmText}
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={isBusy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          border: "1px solid var(--color-border-lighter)",
          boxShadow: "0 18px 40px rgba(0, 0, 0, 0.12)",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          px: 3,
          pt: 3,
          pb: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, pr: 1 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              backgroundColor: iconBackground,
            }}
          >
            <WarningAmberRoundedIcon sx={{ color: iconColor, fontSize: 24 }} />
          </Box>
          <Typography
            variant="h6"
            sx={{ color: "var(--color-text-heading)", fontWeight: 700, lineHeight: 1.2 }}
          >
            {title}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          disabled={isBusy}
          sx={{ color: "var(--color-text-icon)", mt: -0.5, mr: -0.5 }}
          aria-label="Close confirmation dialog"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 1.5 }}>
        {typeof message === "string" || typeof message === "number" ? (
          <Typography sx={messageStyles}>{message}</Typography>
        ) : (
          <Box sx={messageStyles}>{message}</Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 1,
          gap: 1,
          borderTop: "1px solid var(--color-border-lighter)",
          backgroundColor: "var(--color-background-main)",
        }}
      >
        {actions}
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;
