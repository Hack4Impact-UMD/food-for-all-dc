import React from "react";
import { describe, expect, it, jest } from "@jest/globals";
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

const renderAutocomplete = (
  selectedCaseWorker: CaseWorker | null = null,
  handleCaseWorkerChange: (caseWorker: CaseWorker | null) => void = jest.fn()
) => {
  render(
    <BasicInfoForm
      clientProfile={{ headOfHousehold: "Adult" } as any}
      isEditing
      errors={{}}
      renderField={() => null}
      fieldLabelStyles={{}}
      selectedCaseWorker={selectedCaseWorker}
      caseWorkers={options.filter(({ id }) => id !== "edit_list")}
      setShowCaseWorkerModal={() => undefined}
      handleCaseWorkerChange={handleCaseWorkerChange}
    />
  );

  return screen.getByRole("combobox") as HTMLInputElement;
};

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
    const input = renderAutocomplete();
    fireEvent.focus(input);
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

  it("shows every choice when opening a saved referral", () => {
    renderAutocomplete(options[1]);

    fireEvent.click(screen.getByTitle("Open"));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Edit Case Worker List",
      "Peter Adams, Agency One",
      "Peter Brown, Agency Two",
      "Alice Jones, Peter Foundation",
      "Robin Smith, Other Agency",
    ]);
  });

  it("restores the saved referral when typed text is abandoned", () => {
    const handleCaseWorkerChange = jest.fn();
    const input = renderAutocomplete(options[1], handleCaseWorkerChange);

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "rob" } });
    fireEvent.blur(input);

    expect(input.value).toBe("Peter Adams, Agency One");
    expect(handleCaseWorkerChange).not.toHaveBeenCalled();
  });
});
