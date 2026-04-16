function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

const COMPLETE_STATUSES = new Set([
  "completed",
  "published",
  "ready for loading",
  "ready to publish",
]);

export function normalizeProjectStatus(value: unknown, fallback = "In Progress"): string {
  const raw = normalizeWhitespace(String(value || "").replace(/\*/g, ""));
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  if (lower === "completed") return "Completed";
  if (lower === "published") return "Published";
  if (lower === "ready for loading") return "Ready for Loading";
  if (lower === "ready to publish") return "Ready to Publish";
  if (lower === "in progress" || lower === "in-progress") return "In Progress";

  return raw;
}

export function isCompletedProjectStatus(status: unknown): boolean {
  const normalized = normalizeProjectStatus(status, "").toLowerCase();
  return COMPLETE_STATUSES.has(normalized);
}
