import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";

// TagManager reaches Firestore on import; the view-mode path under test never uses it.
jest.mock("../../../pages/Profile/Tags/TagManager", () => () => null);

import FormField from "../../../pages/Profile/components/FormField";
import { ClientProfileKey } from "../../../pages/Profile/types";

const renderViewMode = (fieldPath: string, value: unknown, type = "number") =>
  render(
    <FormField
      fieldPath={fieldPath as ClientProfileKey}
      value={value}
      type={type}
      isEditing={false}
      handleChange={jest.fn()}
      getNestedValue={(obj: any, path: string) =>
        path.split(".").reduce((acc, part) => acc?.[part], obj)
      }
      handleDietaryRestrictionChange={jest.fn()}
      tags={[]}
      allTags={[]}
      isModalOpen={false}
      setIsModalOpen={jest.fn()}
      handleTag={jest.fn()}
    />
  );

describe("FormField view mode value rendering", () => {
  // App coverage:
  // - profile view mode renders household counts (adults/children/seniors/total)
  // - a falsy check previously turned a legitimate 0 into "N/A", so view mode
  //   disagreed with edit mode for any client with no children or no seniors
  // Behavior contract: zero is a real value and must render as "0".
  it.each(["adults", "children", "seniors", "total"])(
    "renders a zero count for %s instead of N/A",
    (fieldPath) => {
      const { container } = renderViewMode(fieldPath, 0);

      expect(container.textContent).toBe("0");
      expect(screen.queryByText("N/A")).toBeNull();
    }
  );

  // Behavior contract: only genuinely empty values fall back to the N/A placeholder.
  it.each([
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
  ])("still shows N/A for %s", (_label, value) => {
    const { container } = renderViewMode("phone", value, "text");

    expect(container.textContent).toBe("N/A");
  });

  it("renders populated values unchanged", () => {
    const { container } = renderViewMode("phone", "202-555-0100", "text");

    expect(container.textContent).toBe("202-555-0100");
  });

  it.each([
    ["notes", "Admin Notes"],
    ["deliveryDetails.deliveryInstructions", "Delivery Instructions"],
    ["address2", "Address 2"],
    ["ward", "Ward"],
  ])("makes the read-only %s field keyboard-accessible", (fieldPath, accessibleName) => {
    renderViewMode(fieldPath, "Long field value ".repeat(50), "textarea");

    const multilineRegion = screen.getByRole("region", { name: accessibleName });
    expect(multilineRegion.getAttribute("tabindex")).toBe("0");

    multilineRegion.focus();
    expect(document.activeElement).toBe(multilineRegion);
  });

  it("preserves the PR's multiline height and scrolling behavior", () => {
    renderViewMode("notes", "Long admin notes ".repeat(50), "textarea");

    const notesRegion = screen.getByRole("region", { name: "Admin Notes" });
    const styles = getComputedStyle(notesRegion);

    expect(styles.maxHeight).toBe("120px");
    expect(styles.overflowY).toBe("auto");
    expect(styles.paddingRight).toBe("8px");
  });

  it("does not add a keyboard stop to a regular read-only field", () => {
    const { container } = renderViewMode("phone", "202-555-0100", "text");
    const phoneDisplay = container.firstElementChild;

    expect(phoneDisplay?.getAttribute("tabindex")).toBeNull();
    expect(phoneDisplay?.getAttribute("role")).toBeNull();
    expect(phoneDisplay?.getAttribute("aria-label")).toBeNull();
  });
});

describe("FormField date editing", () => {
  // App coverage:
  // - profile edit mode commits date fields (start/end date, DOB) on blur as well as on change
  // - the blur handler rebuilt the event from a spread of the DOM input, which drops name, so the
  //   profile wrote the value under a field literally called "undefined" and saved it to Firestore
  // Behavior contract: every event the date field emits identifies the field it came from.
  it("keeps the field name on both the change and the blur event", () => {
    const handleChange = jest.fn();

    render(
      <FormField
        fieldPath={"endDate" as ClientProfileKey}
        value="12/31/2026"
        type="date"
        isEditing={true}
        handleChange={handleChange as any}
        getNestedValue={(obj: any, path: string) =>
          path.split(".").reduce((acc, part) => acc?.[part], obj)
        }
        handleDietaryRestrictionChange={jest.fn()}
        tags={[]}
        allTags={[]}
        isModalOpen={false}
        setIsModalOpen={jest.fn()}
        handleTag={jest.fn()}
      />
    );

    const endDateInput = document.querySelector('input[name="endDate"]') as HTMLInputElement;
    fireEvent.change(endDateInput, { target: { value: "2027-06-30" } });
    fireEvent.blur(endDateInput, { target: { value: "2027-06-30" } });

    const emittedEvents = (handleChange.mock.calls as any[]).map(([event]) => event.target);
    expect(emittedEvents.length).toBe(2);
    emittedEvents.forEach((target) => {
      expect(target.name).toBe("endDate");
      expect(target.value).toBe("06/30/2027");
    });
  });
});
