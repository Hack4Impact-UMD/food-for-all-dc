import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UsersSpreadsheet from '../components/UsersSpreadsheet/UsersSpreadsheet';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { authUserService } from '../services/AuthUserService';
jest.mock('../services/AuthUserService');
beforeEach(() => {
  (authUserService.getAllUsers as jest.Mock).mockResolvedValue([
    {
      id: 'test-uid',
      uid: 'test-uid',
      name: 'Test User',
      role: 2,
      phone: '555-1234',
      email: 'test@example.com',
    },
  ]);
});

const theme = createTheme();

describe('UsersSpreadsheet minimal integration', () => {
  it('renders with minimal props and providers', async () => {
    // Only mock onAuthStateChanged to prevent redirect
    const mockOnAuthStateChanged = (auth: any, callback: any) => {
      callback({ uid: 'test-uid', email: 'test@example.com' });
      return () => {};
    };

    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <UsersSpreadsheet onAuthStateChangedOverride={mockOnAuthStateChanged} />
        </MemoryRouter>
      </ThemeProvider>
    );
    // Wait for either the table or the mobile card view to appear
    await waitFor(() => {
      expect(screen.getByText(/Test User/)).toBeInTheDocument();
      expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    }, { timeout: 15000 });
  });
});
