import React from "react";
import { render, screen } from "@testing-library/react";
import "../setupTests";
import { ThemeProvider, createTheme } from "@mui/material/styles";

describe("Minimal Test with MUI ThemeProvider", () => {
  it("renders a div inside ThemeProvider", () => {
    const theme = createTheme();
    render(
      <ThemeProvider theme={theme}>
        <div>Hello MUI</div>
      </ThemeProvider>
    );
    expect(screen.getByText("Hello MUI")).toBeInTheDocument();
  });
});
