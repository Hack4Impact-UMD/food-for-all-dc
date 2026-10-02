import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import FilterValueInput from "./FilterValueInput";
import type { QueryFieldDef } from "../../types/query-tool-types";

const phoneField: QueryFieldDef = {
  field: "phone",
  label: "Phone",
  type: "text",
  format: "phone",
};

const renderPhoneInput = (onChange = jest.fn()) => {
  render(
    <FilterValueInput
      id="phone-filter"
      fieldDef={phoneField}
      operator="=="
      value=""
      onChange={onChange}
      tagOptions={[]}
      referralOrgOptions={[]}
      driverOptions={[]}
      fieldOptions={["2024898676", "(571) 330-1121", "12345", "20248986762024898676"]}
    />
  );
  return onChange;
};

describe("FilterValueInput phone smart values", () => {
  it("preserves freely typed phone punctuation", () => {
    const onChange = renderPhoneInput();
    const input = screen.getByRole("combobox", { name: "Value" });

    fireEvent.change(input, { target: { value: "(202) 4" } });

    expect(onChange).toHaveBeenLastCalledWith("(202) 4");
  });

  it("offers formatted phone values from the selected collection", async () => {
    renderPhoneInput();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Value" }));

    expect(await screen.findByRole("option", { name: "(202) 489-8676" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "(571) 330-1121" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "(123) 45" })).toBeNull();
  });
});

describe("FilterValueInput date values", () => {
  it("shows a calendar picker for route delivery dates", () => {
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <FilterValueInput
          id="delivery-date-filter"
          fieldDef={{ field: "deliveryDate", label: "Delivery Date", type: "timestamp", format: "date" }}
          operator="=="
          value=""
          onChange={jest.fn()}
          tagOptions={[]}
          referralOrgOptions={[]}
          driverOptions={[]}
          fieldOptions={[]}
        />
      </LocalizationProvider>
    );

    expect(screen.getByRole("button", { name: /choose date/i })).toBeTruthy();
  });

  it("keeps a picked date as a Date instead of converting it during editing", () => {
    const onChange = jest.fn();
    render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <FilterValueInput
          id="delivery-date-filter"
          fieldDef={{ field: "deliveryDate", label: "Delivery Date", type: "timestamp", format: "date" }}
          operator="=="
          value={new Date(2027, 7, 24)}
          onChange={onChange}
          tagOptions={[]}
          referralOrgOptions={[]}
          driverOptions={[]}
          fieldOptions={[]}
        />
      </LocalizationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /choose date/i }));
    fireEvent.click(screen.getByRole("gridcell", { name: "25" }));

    expect(onChange).toHaveBeenLastCalledWith(new Date(2027, 7, 25));
  });

});
