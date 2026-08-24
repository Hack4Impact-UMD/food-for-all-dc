import React from "react";
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CaseWorker } from "../../../types";
import BasicInfoForm, { filterReferralEntityOptions } from "./BasicInfoForm";

const options: CaseWorker[] = [
  { id: "edit_list", name: "Edit Case Worker List", organization: "", phone: "", email: "" },
  { id: "peter-1", name: "Peter Adams", organization: "Agency One", phone: "", email: "" },
  { id: "peter-2", name: "Peter Brown", organization: "Agency Two", phone: "", email: "" },
  { id: "alice", name: "Alice Jones", organization: "Peter Foundation", phone: "", email: "" },
  { id: "robin", name: "Robin Smith", organization: "Other Agency", phone: "", email: "" },
];

const filterState = (inputValue: string) => ({ inputValue });

describe("filterReferralEntityOptions", () => {
  it.each([
    ["Peter", ["peter-1", "peter-2"]],
    ["rob", ["robin"]],
    ["JONES", ["alice"]],
    ["not-a-case-worker", []],
  ])("filters arbitrary input %s against names", (searchText, expectedIds) => {
    expect(
      filterReferralEntityOptions(options, filterState(searchText)).map(({ id }) => id)
    ).toEqual(expectedIds);
  });

  it("matches case-insensitively and ignores surrounding spaces", () => {
    expect(filterReferralEntityOptions(options, filterState("  pEtEr  "))).toHaveLength(2);
  });

  it("shows all options, including list management, before searching", () => {
    expect(filterReferralEntityOptions(options, filterState(""))).toEqual(options);
  });

  it("does not match text found only in an organization", () => {
    expect(filterReferralEntityOptions(options, filterState("Foundation"))).toEqual([]);
  });
});

describe("BasicInfoForm referral entity autocomplete", () => {
  it("renders only the matching name for arbitrary typed text on the Client Profile page", async () => {
    render(
      <BasicInfoForm
        clientProfile={{ headOfHousehold: "Adult" } as any}
        isEditing
        errors={{}}
        renderField={() => null}
        fieldLabelStyles={{}}
        selectedCaseWorker={null}
        caseWorkers={options.filter(({ id }) => id !== "edit_list")}
        setShowCaseWorkerModal={() => undefined}
        handleCaseWorkerChange={() => undefined}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "peter" } });

    await waitFor(() => {
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Peter Adams, Agency One",
        "Peter Brown, Agency Two",
      ]);
    });

    fireEvent.change(input, { target: { value: "rob" } });

    await waitFor(() => {
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Robin Smith, Other Agency",
      ]);
    });
    expect(screen.queryByText("Peter Adams, Agency One")).toBeNull();
    expect(screen.queryByText("Peter Brown, Agency Two")).toBeNull();
    expect(screen.queryByText("Alice Jones, Peter Foundation")).toBeNull();
    expect(screen.queryByText("Edit Case Worker List")).toBeNull();
  });
});