import { describe, expect, it } from "@jest/globals";
import { formatDietaryRestrictionsForExport } from "../../utils/exportFormatters";

describe("formatDietaryRestrictionsForExport", () => {
  // App coverage:
  // - client export flows surface boolean dietary flags as human-readable labels
  // - label mapping regressions produce unreadable or missing dietary information in CSV exports
  // Behavior contract: enabled boolean restriction keys map to their configured export labels.
  it("includes labels for enabled boolean dietary restrictions", () => {
    const result = formatDietaryRestrictionsForExport({
      halal: true,
      vegan: true,
      microwaveOnly: true,
      lowSugar: false,
    });

    expect(result).toBe("Halal, Microwave Only, Vegan");
  });

  // App coverage:
  // - export rows can include allergens plus custom free-text notes from intake/profile forms
  // - preserving all user-provided dietary context is important for downstream meal prep
  // Behavior contract: allergens, Other flag, otherText, and dietaryPreferences are appended in order.
  it("appends allergens and custom dietary text fields", () => {
    const result = formatDietaryRestrictionsForExport({
      vegetarian: true,
      foodAllergens: ["Peanuts", "Shellfish"],
      other: true,
      otherText: " No spicy food ",
      dietaryPreferences: " Lactose free ",
    });

    expect(result).toBe(
      "Vegetarian, Peanuts, Shellfish, Other, No spicy food, Lactose free"
    );
  });

  // App coverage:
  // - exports must render stable fallback text when dietary data is absent or empty
  // - a predictable fallback avoids blank or malformed cells in generated reports
  // Behavior contract: undefined or empty restriction sets resolve to "None".
  it("returns None when restrictions are missing or empty", () => {
    expect(formatDietaryRestrictionsForExport(undefined)).toBe("None");
    expect(formatDietaryRestrictionsForExport({})).toBe("None");
    expect(
      formatDietaryRestrictionsForExport({
        foodAllergens: [],
        other: false,
        otherText: "   ",
        dietaryPreferences: "   ",
      })
    ).toBe("None");
  });
});
