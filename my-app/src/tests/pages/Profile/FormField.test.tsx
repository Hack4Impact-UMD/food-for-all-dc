import React from "react";
import { render, screen } from "@testing-library/react";
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
});
