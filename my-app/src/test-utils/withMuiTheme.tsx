import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export const WithMuiTheme: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
