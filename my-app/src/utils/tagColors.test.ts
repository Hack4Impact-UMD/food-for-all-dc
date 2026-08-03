import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_TAG_COLOR,
  editTagMetadata,
  getReadableTagTextColor,
  getTagColor,
  normalizeTagColors,
} from "./tagColors";

describe("tagColors", () => {
  it("normalizes valid stored colors and replaces invalid values", () => {
    expect(
      normalizeTagColors({
        Priority: "#ABCDEF",
        Delivery: "not-a-color",
      })
    ).toEqual({
      Priority: "#abcdef",
      Delivery: DEFAULT_TAG_COLOR,
    });
  });

  it("uses the legacy default when a tag has no configured color", () => {
    expect(getTagColor("Legacy tag", {})).toBe(DEFAULT_TAG_COLOR);
  });

  it("chooses readable text for light and dark backgrounds", () => {
    expect(getReadableTagTextColor("#ffffff")).toBe("#000000");
    expect(getReadableTagTextColor("#000000")).toBe("#ffffff");
    expect(getReadableTagTextColor("#777777")).toBe("#000000");
    expect(getReadableTagTextColor("#257e68")).toBe("#ffffff");
  });

  it("renames a tag and moves its color metadata", () => {
    expect(
      editTagMetadata(
        ["Priority", "Delivery"],
        { Priority: "#1976d2", Delivery: "#257e68" },
        "Priority",
        "Urgent",
        "#c2185b"
      )
    ).toEqual({
      tags: ["Delivery", "Urgent"],
      tagColors: { Delivery: "#257e68", Urgent: "#c2185b" },
    });
  });
});
