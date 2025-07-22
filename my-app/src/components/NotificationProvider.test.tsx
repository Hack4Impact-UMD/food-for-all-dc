it('NotificationProvider minimal test', () => {
  expect(true).toBe(true);
});
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationProvider, useNotifications } from './NotificationProvider';

// Test component to interact with the notification system
const TestComponent = () => {
  const { showSuccess, showError } = useNotifications();

  return (
    <div>
      <button onClick={() => showSuccess('Test message')}>
        Show Success
      </button>
      <button onClick={() => showError('Error message')}>
        Show Error
      </button>
    </div>
  );
};

describe('NotificationProvider', () => {
  it('renders children', () => {
    render(
      <NotificationProvider>
        <div>Test content</div>
      </NotificationProvider>
    );
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('displays success notification', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );
    
    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('displays error notification', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );
    
    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });
});
