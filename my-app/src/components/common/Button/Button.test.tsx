import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../test-utils";
import Button from "./Button";

describe("Button", () => {
  it("renders with text", () => {
    renderWithProviders(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("handles click events", () => {
    const handleClick = jest.fn();
    renderWithProviders(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders as disabled when disabled prop is true", () => {
    renderWithProviders(<Button disabled>Click me</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("renders different variants", () => {
    renderWithProviders(<Button variant="primary">Primary</Button>);
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("renders different colors", () => {
    renderWithProviders(<Button color="primary">Primary</Button>);
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    renderWithProviders(<Button loading>Loading</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
