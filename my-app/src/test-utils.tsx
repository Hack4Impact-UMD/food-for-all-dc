import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { NotificationProvider } from "./components/NotificationProvider";

// Create a test theme similar to the app's theme
const testTheme = createTheme({
  palette: {
    primary: {
      main: "#2E5B4C",
    },
    secondary: {
      main: "#f50057",
    },
  },
});

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  withNotifications?: boolean;
  withTheme?: boolean;
}

const customRender = (ui: React.ReactElement, options: CustomRenderOptions = {}) => {
  const { withNotifications = true, withTheme = true, ...renderOptions } = options;

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    let wrapped = children;

    if (withTheme) {
      wrapped = <ThemeProvider theme={testTheme}>{wrapped}</ThemeProvider>;
    }

    if (withNotifications) {
      wrapped = <NotificationProvider>{wrapped}</NotificationProvider>;
    }

    return <>{wrapped}</>;
  };

  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
};

// Helper function to test keyboard navigation
export const testKeyboardNavigation = async (
  getByRole: (role: string) => HTMLElement,
  elements: string[]
) => {
  const { fireEvent } = await import("@testing-library/react");

  for (let i = 0; i < elements.length; i++) {
    const element = getByRole(elements[i]);
    fireEvent.keyDown(element, { key: "Tab", code: "Tab" });
    expect(element).toHaveFocus();
  }
};

// Export everything from testing-library
export * from "@testing-library/react";
export { customRender as render };
export { customRender as renderWithProviders };
