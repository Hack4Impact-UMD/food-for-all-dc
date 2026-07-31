import { describe, expect, it } from "@jest/globals";
import { deliveryDate } from "./deliveryDate";

describe("deliveryDate.getUTCDateBounds", () => {
  it("uses the logical Eastern date instead of browser-local date getters", () => {
    class UTCPlusNineDate extends Date {
      getFullYear() {
        return 2026;
      }

      getMonth() {
        return 6;
      }

      getDate() {
        return 31;
      }
    }

    const july30EasternMidday = new UTCPlusNineDate("2026-07-30T16:00:00.000Z");

    expect(july30EasternMidday.getDate()).toBe(31);

    const bounds = deliveryDate.getUTCDateBounds(july30EasternMidday);

    expect(bounds.start.toISOString()).toBe("2026-07-30T00:00:00.000Z");
    expect(bounds.endExclusive.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("returns an exclusive next-day boundary", () => {
    const bounds = deliveryDate.getUTCDateBounds("2026-11-01");

    expect(bounds.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(bounds.endExclusive.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });
});
