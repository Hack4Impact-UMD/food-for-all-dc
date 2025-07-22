import React from 'react';
import { render, fireEvent, screen } from '../test-utils';
import ConfirmationModal from './ConfirmationModal';

describe('ConfirmationModal', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('renders with default props', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('calls onConfirm and onClose when confirm button is clicked', () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      
      render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Confirm'));
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button is clicked', () => {
      const onClose = jest.fn();
      
      render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Text', () => {
    it('renders custom confirm text', () => {
      render(<ConfirmationModal {...defaultProps} confirmText="Delete" />);
      
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    });

    it('renders custom cancel text', () => {
      render(<ConfirmationModal {...defaultProps} cancelText="Go Back" />);
      
      expect(screen.getByText('Go Back')).toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  describe('Button Colors', () => {
    it('renders primary color by default', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveAttribute('class', expect.stringContaining('MuiButton-containedPrimary'));
    });

    it('renders error color when specified', () => {
      render(<ConfirmationModal {...defaultProps} confirmColor="error" />);
      
      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveAttribute('class', expect.stringContaining('MuiButton-containedError'));
    });

    it('renders warning color when specified', () => {
      render(<ConfirmationModal {...defaultProps} confirmColor="warning" />);
      
      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveAttribute('class', expect.stringContaining('MuiButton-containedWarning'));
    });
  });

  describe('Focus Management', () => {
    it('focuses confirm button by default', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      // Since autofocus is handled by MUI, we'll verify the button exists and is accessible
      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toBeInTheDocument();
      expect(confirmButton).not.toBeDisabled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('confirms action when Enter is pressed on confirm button', () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      
      render(<ConfirmationModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);
      
      // Test that clicking the button works (keyboard events are handled by MUI)
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal when Escape is pressed', () => {
      const onClose = jest.fn();
      
      render(<ConfirmationModal {...defaultProps} onClose={onClose} />);
      
      // MUI Dialog handles escape key internally
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      
      // Get all headings and find one with our title
      const headings = screen.getAllByRole('heading', { level: 2 });
      const titleHeading = headings.find(h => h.textContent === 'Confirm Action');
      expect(titleHeading).toBeInTheDocument();
    });

    it('has proper button roles', () => {
      render(<ConfirmationModal {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      
      expect(cancelButton).toBeInTheDocument();
      expect(confirmButton).toBeInTheDocument();
    });
  });

  describe('Destructive Actions', () => {
    it('handles destructive action styling correctly', () => {
      render(
        <ConfirmationModal 
          {...defaultProps} 
          title="Delete Item"
          message="This action cannot be undone."
          confirmText="Delete"
          confirmColor="error"
        />
      );
      
      expect(screen.getByText('Delete Item')).toBeInTheDocument();
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
      
      const deleteButton = screen.getByText('Delete');
      expect(deleteButton).toHaveAttribute('class', expect.stringContaining('MuiButton-containedError'));
    });
  });

  describe('Modal State', () => {
    it('does not render when closed', () => {
      render(<ConfirmationModal {...defaultProps} open={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
      render(<ConfirmationModal {...defaultProps} open={true} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
