function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeProjectStatus(value: unknown, fallback = "In Progress"): string {
  const raw = normalizeWhitespace(String(value || "").replace(/\*/g, ""));
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  if (lower === "completed" || lower === "complete") return "Completed";
  if (lower === "published") return "Published";
  if (lower === "in progress" || lower === "in-progress") return "In Progress";

  return raw;
}

export function isCompletedProjectStatus(status: unknown): boolean {
  const normalized = normalizeProjectStatus(status, "").toLowerCase();
  return normalized === "completed" || normalized === "complete" || normalized === "published";
}
