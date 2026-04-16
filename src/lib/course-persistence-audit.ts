export type CoursePersistenceInputRow = {
  key: string;
  courseName: string;
  year: string;
  rawYear: string;
  source: string;
  rawStatus: string;
  isComplete: boolean;
};

export type CoursePersistenceAuditReason =
  | "Persisted"
  | "Missing from persisted projects"
  | "Will be deleted as stale on import"
  | "Duplicate course key collision"
  | "Missing reporting year"
  | "Malformed reporting year"
  | "Reporting year mismatch"
  | "Completion bucket mismatch"
  | "Raw status mismatch";

export type CoursePersistenceAuditRow = {
  key: string;
  courseName: string;
  year: string;
  rawYear: string;
  source: string;
  uploadRowCount: number;
  uploadStatus: string;
  persisted: boolean;
  persistedStatus: string;
  reason: CoursePersistenceAuditReason;
};

function isCleanFourDigitYear(value: unknown): boolean {
  return /^\d{4}$/.test(String(value || "").trim());
}

function compareYearLabel(a: string, b: string): number {
  const aYear = /^\d{4}$/.test(a) ? Number(a) : Number.NaN;
  const bYear = /^\d{4}$/.test(b) ? Number(b) : Number.NaN;
  if (!Number.isNaN(aYear) && !Number.isNaN(bYear)) return aYear - bYear;
  if (!Number.isNaN(aYear)) return -1;
  if (!Number.isNaN(bYear)) return 1;
  return a.localeCompare(b);
}

function distinctNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function joinDistinct(values: string[], fallback = "(blank)"): string {
  const cleaned = distinctNonEmpty(values);
  return cleaned.length > 0 ? cleaned.join(" | ") : fallback;
}

function normalizeSourceLabel(source: string): string {
  return source.trim().toLowerCase();
}

function classifyAuditReason(
  uploadRows: CoursePersistenceInputRow[],
  persistedRows: CoursePersistenceInputRow[],
): CoursePersistenceAuditReason {
  const upload = uploadRows[0];
  const persisted = persistedRows[0];

  if (uploadRows.length > 1) return "Duplicate course key collision";
  if (upload && !upload.rawYear.trim()) return "Missing reporting year";
  if (upload && upload.rawYear.trim() && !isCleanFourDigitYear(upload.rawYear)) return "Malformed reporting year";
  if (!upload && persisted) return "Will be deleted as stale on import";
  if (upload && !persisted) return "Missing from persisted projects";
  if (!upload || !persisted) return "Persisted";
  if (upload.rawYear !== persisted.rawYear) return "Reporting year mismatch";
  if (upload.isComplete !== persisted.isComplete) return "Completion bucket mismatch";
  if (upload.rawStatus !== persisted.rawStatus) return "Raw status mismatch";
  return "Persisted";
}

function auditRank(reason: CoursePersistenceAuditReason): number {
  const order: CoursePersistenceAuditReason[] = [
    "Duplicate course key collision",
    "Missing reporting year",
    "Malformed reporting year",
    "Missing from persisted projects",
    "Will be deleted as stale on import",
    "Reporting year mismatch",
    "Completion bucket mismatch",
    "Raw status mismatch",
    "Persisted",
  ];
  return order.indexOf(reason);
}

export function buildCoursePersistenceAuditRows(
  uploadRows: CoursePersistenceInputRow[],
  persistedRows: CoursePersistenceInputRow[],
): CoursePersistenceAuditRow[] {
  const uploadGroups = new Map<string, CoursePersistenceInputRow[]>();
  const persistedGroups = new Map<string, CoursePersistenceInputRow[]>();

  uploadRows.forEach((row) => {
    const group = uploadGroups.get(row.key) || [];
    group.push(row);
    uploadGroups.set(row.key, group);
  });

  persistedRows.forEach((row) => {
    const group = persistedGroups.get(row.key) || [];
    group.push(row);
    persistedGroups.set(row.key, group);
  });

  const allKeys = new Set<string>([...uploadGroups.keys(), ...persistedGroups.keys()]);

  return [...allKeys]
    .map((key) => {
      const uploadGroup = uploadGroups.get(key) || [];
      const persistedGroup = persistedGroups.get(key) || [];
      const upload = uploadGroup[0];
      const persisted = persistedGroup[0];
      const reason = classifyAuditReason(uploadGroup, persistedGroup);

      return {
        key,
        courseName: upload?.courseName || persisted?.courseName || "(unknown course)",
        year: upload?.year || persisted?.year || "Unknown",
        rawYear: joinDistinct([
          ...uploadGroup.map((row) => row.rawYear),
          ...persistedGroup.map((row) => row.rawYear),
        ]),
        source: joinDistinct(
          [...uploadGroup.map((row) => normalizeSourceLabel(row.source)), ...persistedGroup.map((row) => normalizeSourceLabel(row.source))],
          "unknown",
        ),
        uploadRowCount: uploadGroup.length,
        uploadStatus: joinDistinct(uploadGroup.map((row) => row.rawStatus)),
        persisted: persistedGroup.length > 0,
        persistedStatus: joinDistinct(persistedGroup.map((row) => row.rawStatus)),
        reason,
      };
    })
    .sort((a, b) =>
      auditRank(a.reason) - auditRank(b.reason) ||
      compareYearLabel(a.year, b.year) ||
      a.courseName.localeCompare(b.courseName),
    );
}
