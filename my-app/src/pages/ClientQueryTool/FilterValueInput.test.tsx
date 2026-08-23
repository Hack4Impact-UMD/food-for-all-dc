import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
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
