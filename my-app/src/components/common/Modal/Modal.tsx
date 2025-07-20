import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import styles from './Modal.module.css';

/**
 * Reusable Modal base component with consistent styling and accessibility
 * 
 * @example
 * // Basic modal
 * <Modal open={isOpen} onClose={handleClose} title="Confirm Action">
 *   <p>Are you sure you want to proceed?</p>
 * </Modal>
 * 
 * // Modal with custom actions
 * <Modal 
 *   open={isOpen} 
 *   onClose={handleClose} 
 *   title="Delete Item"
 *   actions={<Button onClick={handleDelete}>Delete</Button>}
 * >
 *   <p>This action cannot be undone.</p>
 * </Modal>
 */
interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Function to call when modal should close */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal content */
  children: React.ReactNode;
  /** Custom actions for the modal footer */
  actions?: React.ReactNode;
  /** Maximum width of the modal */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Whether clicking outside closes the modal */
  closeOnBackdropClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  showCloseButton = true,
  closeOnBackdropClick = true,
}) => {
  const handleClose = (_event: object, reason: string) => {
    if (!closeOnBackdropClick && reason === 'backdropClick') {
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth
      className={styles.modal}
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          overflow: 'visible',
        },
      }}
    >
      <DialogTitle className={styles.modalTitle}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" component="h2" className={styles.titleText}>
            {title}
          </Typography>
          {showCloseButton && (
            <IconButton
              onClick={onClose}
              className={styles.closeButton}
              size="small"
              aria-label="Close modal"
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>
      
      <DialogContent className={styles.modalContent}>
        {children}
      </DialogContent>
      
      {actions && (
        <DialogActions className={styles.modalActions}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default Modal;
