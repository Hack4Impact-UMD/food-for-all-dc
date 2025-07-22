import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

export function WithMuiTheme({ children }: { children: React.ReactNode }): JSX.Element {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
