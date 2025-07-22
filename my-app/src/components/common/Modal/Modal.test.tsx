import React from 'react';
import { render, fireEvent, screen } from '../../../test-utils';
import Modal from './Modal';

describe('Modal Component', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('renders modal when open is true', () => {
      render(<Modal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render modal when open is false', () => {
      render(<Modal {...defaultProps} open={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Close Button', () => {
    it('shows close button by default', () => {
      render(<Modal {...defaultProps} />);
      
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });

    it('hides close button when showCloseButton is false', () => {
      render(<Modal {...defaultProps} showCloseButton={false} />);
      
      expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
    });
  });

  describe('Backdrop Click', () => {
    it('closes modal on backdrop click by default', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      // Click on backdrop (not the dialog content)
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
      }
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close modal on backdrop click when closeOnBackdropClick is false', () => {
      const onClose = jest.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnBackdropClick={false} />);
      
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
      }
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Actions', () => {
    it('renders actions when provided', () => {
      const actions = <button>Action Button</button>;
      render(<Modal {...defaultProps} actions={actions} />);
      
      expect(screen.getByText('Action Button')).toBeInTheDocument();
    });

    it('does not render actions section when no actions provided', () => {
      render(<Modal {...defaultProps} />);
      
      expect(screen.queryByText('Action Button')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<Modal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      
      const title = screen.getByText('Test Modal');
      expect(title).toBeInTheDocument();
    });

    it('has proper heading structure', () => {
      render(<Modal {...defaultProps} />);
      
      // Get all headings and find one with our title
      const headings = screen.getAllByRole('heading', { level: 2 });
      const titleHeading = headings.find(h => h.textContent === 'Test Modal');
      expect(titleHeading).toBeInTheDocument();
    });
  });
});