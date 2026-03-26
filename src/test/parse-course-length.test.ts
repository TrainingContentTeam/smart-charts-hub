import { describe, expect, it } from "vitest";
import { parseCourseLengthHours } from "@/lib/parse-duration";

describe("parseCourseLengthHours", () => {
  it("parses numeric and clock-like values", () => {
    expect(parseCourseLengthHours("2")).toBe(2);
    expect(parseCourseLengthHours("1.5")).toBe(1.5);
    expect(parseCourseLengthHours("1:30")).toBe(1.5);
    expect(parseCourseLengthHours("1:30:00")).toBe(1.5);
  });

  it("parses unit-based hour and minute text", () => {
    expect(parseCourseLengthHours("2 hr")).toBe(2);
    expect(parseCourseLengthHours("90 min")).toBe(1.5);
    expect(parseCourseLengthHours("1 hr 30 min")).toBe(1.5);
    expect(parseCourseLengthHours("45 minutes")).toBe(0.75);
  });

  it("returns null for blank or invalid values", () => {
    expect(parseCourseLengthHours("")).toBeNull();
    expect(parseCourseLengthHours("TBD")).toBeNull();
    expect(parseCourseLengthHours(null)).toBeNull();
  });
});
