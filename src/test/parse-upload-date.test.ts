import { describe, expect, it } from "vitest";
import { parseUploadDate } from "@/lib/analytics/parse-upload-date";

describe("parseUploadDate (strict ingestion parser)", () => {
  it("accepts numeric Excel serials", () => {
    // 45217 -> 2023-10-01
    expect(parseUploadDate(45217)).toBe("2023-10-01");
  });

  it("accepts integer Excel serials as strings", () => {
    expect(parseUploadDate("45217")).toBe("2023-10-01");
  });

  it("accepts decimal Excel serials as strings", () => {
    expect(parseUploadDate("45217.0")).toBe("2023-10-01");
    expect(parseUploadDate("45217.5")).toBe("2023-10-01");
  });

  it("accepts M/D/YYYY", () => {
    expect(parseUploadDate("3/1/2026")).toBe("2026-03-01");
    expect(parseUploadDate("12/31/2024")).toBe("2024-12-31");
  });

  it("accepts ISO YYYY-MM-DD with optional time", () => {
    expect(parseUploadDate("2026-03-01")).toBe("2026-03-01");
    expect(parseUploadDate("2026-03-01T12:00:00Z")).toBe("2026-03-01");
  });

  it("rejects ambiguous or malformed values without producing far-future dates", () => {
    expect(parseUploadDate("not a date")).toBeNull();
    expect(parseUploadDate("")).toBeNull();
    expect(parseUploadDate(null)).toBeNull();
    expect(parseUploadDate(undefined)).toBeNull();
    // Numbers that look like a year — must not be coerced into a date
    expect(parseUploadDate(2026)).toBeNull();
    // Out-of-window numeric strings
    expect(parseUploadDate("99999999")).toBeNull();
    // The original failure: a stray serial that previously became year 45217
    // must NEVER round-trip into a "+045217-01" style timestamp.
    const result = parseUploadDate("45217.0");
    expect(result).not.toMatch(/^\+/);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts valid Date instances within the safe year window", () => {
    expect(parseUploadDate(new Date(Date.UTC(2026, 2, 1)))).toBe("2026-03-01");
  });
});
