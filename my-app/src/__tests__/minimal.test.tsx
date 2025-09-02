import React from "react";
import { render, screen } from "@testing-library/react";

describe("Minimal Test", () => {
  it("renders a simple div", () => {
    render(<div>Hello World</div>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });
});
