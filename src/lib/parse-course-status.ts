function normalize(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getCellValue(row: Record<string, unknown>, candidate: string): unknown {
  if (candidate in row) return row[candidate];

  const normalizedCandidate = candidate.trim().toLowerCase();
  for (const [key, value] of Object.entries(row)) {
    if (key.trim().toLowerCase() === normalizedCandidate) return value;
  }

  return undefined;
}

export function pickPreferredCourseStatus(row: Record<string, unknown>, lctCandidate: string): string {
  const value = getCellValue(row, lctCandidate);
  if (value === undefined) return "";
  return normalize(value);
}
