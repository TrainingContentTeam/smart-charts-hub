import { describe, expect, it } from "vitest";
import {
  compactCourseName,
  normalizeCourseName,
  normalizePersonName,
  normalizeTextPreserveMeaning,
  parseDurationToMinutes,
  parseReportingYear,
  splitMultiValueField,
} from "@/lib/analytics/normalization";

describe("analytics normalization helpers", () => {
  it("normalizes punctuation, whitespace, and cp1252 artifacts without changing meaning", () => {
    expect(normalizeTextPreserveMeaning("  988 â€“  Suicide   &  Crisis  ")).toBe("988 - Suicide & Crisis");
  });

  it("normalizes course aliases and trailing date artifacts", () => {
    expect(normalizeCourseName("Pre-Hospital Blood Administration 3/4/2026")).toBe("Prehospital Blood Administration");
    expect(compactCourseName("Dispatcher: Stress Mangement")).toBe("dispatcherstressmanagement");
  });

  it("parses reporting years, duration strings, and multivalue fields", () => {
    expect(parseReportingYear("2026 Courses")).toBe("2026");
    expect(parseDurationToMinutes("2 hours 30 min")).toBe(150);
    expect(splitMultiValueField('"Alex Doe", "Sam Roe"')).toEqual(["Alex Doe", "Sam Roe"]);
  });

  it("applies safe person aliases without guessing new ones", () => {
    expect(normalizePersonName("Jeffrey Dino")).toBe("Jeff Dino");
    expect(normalizePersonName("Casey Smith")).toBe("Casey Smith");
  });
});
