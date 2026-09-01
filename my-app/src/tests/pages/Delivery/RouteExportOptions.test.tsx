import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import RouteExportOptions, {
  RouteExportScope,
} from "../../../pages/Delivery/components/RouteExportOptions";

const noop = () => undefined;

const renderOptions = (overrides: Partial<React.ComponentProps<typeof RouteExportOptions>> = {}) =>
  render(
    <RouteExportOptions
      exportOption="Routes"
      exportScope={"all" as RouteExportScope}
      scopeCounts={{ selected: 0, visible: 0, all: 0 }}
      onSelectOption={jest.fn()}
      onSelectScope={jest.fn()}
      onDownload={noop}
      onBack={noop}
      {...overrides}
    />
  );

describe("RouteExportOptions report scopes", () => {
  it("disables the preview when a scope has nothing to print and nothing to assign", () => {
    renderOptions({
      purpose: "report",
      scopeIssueCounts: { selected: 0, visible: 0, all: 0 },
    });

    expect(
      (screen.getByRole("button", { name: "Preview reports" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("keeps the preview reachable when a scope only has unassigned deliveries", () => {
    renderOptions({
      purpose: "report",
      scopeIssueCounts: { selected: 0, visible: 0, all: 3 },
    });

    expect(
      (screen.getByRole("button", { name: "Preview reports" }) as HTMLButtonElement).disabled
    ).toBe(false);
    expect(screen.getByText(/3 rows still need a route or driver and will not print/)).toBeTruthy();
  });

  it("counts only printable deliveries in the scope summary", () => {
    renderOptions({
      purpose: "report",
      scopeCounts: { selected: 0, visible: 0, all: 2 },
      scopeIssueCounts: { selected: 0, visible: 0, all: 3 },
    });

    expect(screen.getByText(/Driver routes • All deliveries for date • 2 rows/)).toBeTruthy();
  });

  it("still gates the export purpose on the row count alone", () => {
    renderOptions();

    expect((screen.getByRole("button", { name: "Download" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
