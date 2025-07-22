import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateUserModal from '../CreateUserModal';

// Minimal props for modal
const defaultProps = {
  open: true,
  handleClose: jest.fn(),
};

describe('CreateUserModal', () => {
  it('shows validation error for empty email', () => {
    render(<CreateUserModal {...defaultProps} />);
    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.change(emailInput, { target: { value: '' } });
    fireEvent.change(passwordInputs[0], { target: { value: '' } });
    fireEvent.blur(emailInput);
    fireEvent.blur(passwordInputs[0]);
    fireEvent.blur(nameInput);
    fireEvent.submit(screen.getByRole('button', { name: /create user/i }));
    expect(screen.getByText(/name, email, and password fields are required/i)).toBeInTheDocument();
  });

  it('shows error if passwords do not match', () => {
    render(<CreateUserModal {...defaultProps} />);
    const passwordInputs = screen.getAllByLabelText(/password/i);
    fireEvent.change(passwordInputs[0], { target: { value: 'abc123' } }); // Password
    fireEvent.change(passwordInputs[1], { target: { value: 'xyz789' } }); // Re-type Password
    fireEvent.blur(passwordInputs[1]);
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });
});
