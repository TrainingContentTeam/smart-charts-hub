import { describe, expect, it } from "vitest";
import {
  parseApprovedDurationHoursMinutes,
  parseApprovedUsShortDate,
} from "@/lib/analytics/field-parsers";

describe("approved analytics field parsers", () => {
  it("parses approved U.S. short dates with modern two-digit year handling", () => {
    expect(parseApprovedUsShortDate("10/18/23")).toBe("2023-10-18");
    expect(parseApprovedUsShortDate("3/9/26")).toBe("2026-03-09");
  });

  it("parses strict HH:MM durations as minutes", () => {
    expect(parseApprovedDurationHoursMinutes("01:15")).toBe(75);
    expect(parseApprovedDurationHoursMinutes("00:05")).toBe(5);
  });

  it("rejects invalid shapes instead of inferring timestamps or timezone-aware dates", () => {
    expect(parseApprovedUsShortDate("2026-03-09")).toBeNull();
    expect(parseApprovedUsShortDate("03/09/2026 14:30")).toBeNull();
    expect(parseApprovedDurationHoursMinutes("03/09/2026 14:30")).toBeNull();
    expect(parseApprovedDurationHoursMinutes("not a duration")).toBeNull();
  });
});
