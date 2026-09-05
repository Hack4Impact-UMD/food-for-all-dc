import { describe, expect, it } from "@jest/globals";
import {
  normalizeClientDatesForRead,
  normalizeClientDatesForWrite,
  toClientDateString,
  toClientDateValue,
} from "./clientDate";

const easternDateKey = (value: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);

describe("toClientDateValue", () => {
  it("parses the ISO form written by the app", () => {
    const result = toClientDateValue("2026-07-23");
    expect(easternDateKey(result!)).toBe("2026-07-23");
  });

  it("parses the MM/DD/YYYY form written by the ETL", () => {
    const result = toClientDateValue("07/23/2026");
    expect(easternDateKey(result!)).toBe("2026-07-23");
  });

  it("stores noon Eastern so the day survives western timezones", () => {
    const result = toClientDateValue("2026-07-23");
    // Noon Eastern is 16:00 UTC during daylight saving time.
    expect(result!.toISOString()).toBe("2026-07-23T16:00:00.000Z");

    const pacific = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(result!);
    expect(pacific).toBe("2026-07-23");
  });

  it("holds the same calendar day outside daylight saving time", () => {
    const result = toClientDateValue("2026-01-15");
    expect(result!.toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(easternDateKey(result!)).toBe("2026-01-15");
  });

  it("recovers a flattened Timestamp map", () => {
    const flattened = { seconds: 1784844095, nanoseconds: 293000000 };
    const result = toClientDateValue(flattened);
    expect(result).toBeInstanceOf(Date);
    expect(easternDateKey(result!)).toBe("2026-07-23");
  });

  it("reads a stored Timestamp-like value back to the same calendar day", () => {
    const stored = { toDate: () => toClientDateValue("2026-03-15")! };
    expect(easternDateKey(toClientDateValue(stored)!)).toBe("2026-03-15");
  });

  it.each([null, undefined, "", "   ", "nan", "N/A", "not a date"])(
    "returns null rather than guessing for %p",
    (value) => {
      expect(toClientDateValue(value)).toBeNull();
    }
  );
});

describe("toClientDateString", () => {
  it("reads both legacy string formats as ISO", () => {
    expect(toClientDateString("07/23/2026")).toBe("2026-07-23");
    expect(toClientDateString("2026-07-23")).toBe("2026-07-23");
  });

  it("reads a Timestamp as ISO", () => {
    expect(toClientDateString(toClientDateValue("2026-07-23"))).toBe("2026-07-23");
  });

  it("returns an empty string for missing values", () => {
    expect(toClientDateString(null)).toBe("");
    expect(toClientDateString("")).toBe("");
  });
});

describe("normalizeClientDatesForWrite", () => {
  it("converts every date field and leaves other fields untouched", () => {
    const result = normalizeClientDatesForWrite({
      firstName: "Carol",
      startDate: "07/23/2026",
      endDate: "2027-07-23",
      tefapCertDate: "",
      adults: 2,
      tags: ["TEFAPOnFile"],
    });

    expect(result.firstName).toBe("Carol");
    expect(result.adults).toBe(2);
    expect(result.tags).toEqual(["TEFAPOnFile"]);
    expect(easternDateKey(result.startDate as Date)).toBe("2026-07-23");
    expect(easternDateKey(result.endDate as Date)).toBe("2027-07-23");
    expect(result.tefapCertDate).toBeNull();
  });

  it("does not add date fields that were absent from the payload", () => {
    const result = normalizeClientDatesForWrite({ startDate: "2026-07-23" });
    expect("endDate" in result).toBe(false);
    expect("dob" in result).toBe(false);
  });

  it("is idempotent", () => {
    const once = normalizeClientDatesForWrite({ startDate: "07/23/2026" });
    const twice = normalizeClientDatesForWrite(once);
    expect((twice.startDate as Date).getTime()).toBe((once.startDate as Date).getTime());
  });
});

describe("normalizeClientDatesForRead", () => {
  it("turns stored Timestamps back into ISO strings", () => {
    const stored = normalizeClientDatesForWrite({
      startDate: "07/23/2026",
      endDate: "",
      firstName: "Carol",
    });

    const result = normalizeClientDatesForRead(stored);

    expect(result.startDate).toBe("2026-07-23");
    expect(result.endDate).toBe("");
    expect(result.firstName).toBe("Carol");
  });

  it("leaves legacy string values readable during the migration window", () => {
    const result = normalizeClientDatesForRead({ startDate: "07/23/2026", endDate: "2026-12-31" });
    expect(result.startDate).toBe("2026-07-23");
    expect(result.endDate).toBe("2026-12-31");
  });
});
