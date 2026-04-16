import { normalizeProjectStatus } from "@/lib/project-status";

export const PROJECT_FILTER_FIELDS = [
  "year",
  "status",
  "type",
  "tool",
  "vertical",
  "assignedId",
  "length",
  "source",
] as const;

export type ProjectFilterField = (typeof PROJECT_FILTER_FIELDS)[number];

export type ProjectMultiFilters = Record<ProjectFilterField, string[]>;

type ProjectFilterConfig = {
  label: string;
  getRawValue: (project: any) => unknown;
  normalize: (value: unknown) => string;
};

const collapseWhitespace = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");

function normalizeReportingYear(value: unknown): string {
  const raw = collapseWhitespace(value);
  const match = raw.match(/\d{4}/);
  if (match) return match[0];
  return raw || "Unknown";
}

function normalizeDefaultLabel(value: unknown): string {
  return collapseWhitespace(value) || "Unknown";
}

function normalizeSource(value: unknown): string {
  const raw = collapseWhitespace(value).toLowerCase();
  return raw || "Unknown";
}

const FILTER_CONFIG: Record<ProjectFilterField, ProjectFilterConfig> = {
  year: {
    label: "Reporting Year",
    getRawValue: (project) => project.reporting_year,
    normalize: normalizeReportingYear,
  },
  status: {
    label: "Status",
    getRawValue: (project) => project.status,
    normalize: (value) => normalizeProjectStatus(value, "Unknown"),
  },
  type: {
    label: "Course Type",
    getRawValue: (project) => project.course_type,
    normalize: normalizeDefaultLabel,
  },
  tool: {
    label: "Authoring Tool",
    getRawValue: (project) => project.authoring_tool,
    normalize: normalizeDefaultLabel,
  },
  vertical: {
    label: "Vertical",
    getRawValue: (project) => project.vertical,
    normalize: normalizeDefaultLabel,
  },
  assignedId: {
    label: "Assigned ID",
    getRawValue: (project) => project.id_assigned,
    normalize: normalizeDefaultLabel,
  },
  length: {
    label: "Course Length",
    getRawValue: (project) => project.course_length,
    normalize: normalizeDefaultLabel,
  },
  source: {
    label: "Data Source",
    getRawValue: (project) => project.data_source,
    normalize: normalizeSource,
  },
};

export const DEFAULT_PROJECT_MULTI_FILTERS: ProjectMultiFilters = {
  year: [],
  status: [],
  type: [],
  tool: [],
  vertical: [],
  assignedId: [],
  length: [],
  source: [],
};

export function getProjectFilterLabel(field: ProjectFilterField): string {
  return FILTER_CONFIG[field].label;
}

export function getNormalizedProjectFilterValue(project: any, field: ProjectFilterField): string {
  return FILTER_CONFIG[field].normalize(FILTER_CONFIG[field].getRawValue(project));
}

export function buildProjectFilterOptions(projects: any[]): Record<ProjectFilterField, string[]> {
  const options = {} as Record<ProjectFilterField, string[]>;

  PROJECT_FILTER_FIELDS.forEach((field) => {
    const values = new Set<string>();
    projects.forEach((project) => values.add(getNormalizedProjectFilterValue(project, field)));
    options[field] = [...values].sort((a, b) => a.localeCompare(b));
  });

  return options;
}

export function matchesProjectMultiFilters(project: any, filters: ProjectMultiFilters): boolean {
  return PROJECT_FILTER_FIELDS.every((field) => {
    const selected = filters[field];
    if (!selected.length) return true;
    return selected.includes(getNormalizedProjectFilterValue(project, field));
  });
}
