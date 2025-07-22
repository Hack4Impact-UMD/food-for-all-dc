it('LoadingIndicator minimal test', () => {
  expect(true).toBe(true);
});
import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import LoadingIndicator from './LoadingIndicator';

describe('LoadingIndicator', () => {
  it('renders loading spinner', () => {
    renderWithProviders(<LoadingIndicator />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    renderWithProviders(<LoadingIndicator text="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('renders different sizes', () => {
    renderWithProviders(<LoadingIndicator size="small" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
