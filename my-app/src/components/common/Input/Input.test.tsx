import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import Input from './Input';

describe('Input', () => {
  it('renders with label', () => {
    renderWithProviders(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('handles input changes', () => {
    const handleChange = jest.fn();
    renderWithProviders(<Input label="Email" onChange={handleChange} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('shows error state', () => {
    renderWithProviders(<Input label="Email" error={true} helperText="Invalid email" />);
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('renders as disabled when disabled prop is true', () => {
    renderWithProviders(<Input label="Email" disabled />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('renders with placeholder', () => {
    renderWithProviders(<Input label="Email" placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });
});
