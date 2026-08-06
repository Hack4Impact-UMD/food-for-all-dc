import { describe, expect, it } from "@jest/globals";
import { normalizeDeliveryTags } from "./deliveryTags";

describe("normalizeDeliveryTags", () => {
  it("keeps a comma-containing tag as one tag", () => {
    expect(normalizeDeliveryTags(["Food, Urgent", "Delivery"])).toEqual([
      "Food, Urgent",
      "Delivery",
    ]);
  });

  it("returns no tags for missing or malformed stored values", () => {
    expect(normalizeDeliveryTags(undefined)).toEqual([]);
    expect(normalizeDeliveryTags("Food, Urgent")).toEqual([]);
  });
});
