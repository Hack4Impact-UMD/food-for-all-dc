import React from "react";
import { render, screen } from "@testing-library/react";
import "../setupTests";

describe("Minimal Test with setupTests", () => {
  it("renders a simple div", () => {
    render(<div>Hello World</div>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });
});
