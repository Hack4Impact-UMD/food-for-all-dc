jest.setTimeout(20000);
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UsersSpreadsheet from '../UsersSpreadsheet';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

describe('UsersSpreadsheet minimal integration', () => {
  it('renders with minimal props and providers', async () => {
    // Only mock onAuthStateChanged to prevent redirect
    const mockOnAuthStateChanged = (auth, callback) => {
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
