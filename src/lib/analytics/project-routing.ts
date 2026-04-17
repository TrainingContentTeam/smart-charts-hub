import type { AnalyticsSnapshot, CanonicalProject } from "@/lib/analytics/types";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "project";
}

function routeYear(reportingYear: string | null) {
  return reportingYear || "unknown";
}

export function buildProjectSlug(projectName: string) {
  return slugify(projectName);
}

export function buildProjectDetailPath(project: Pick<CanonicalProject, "raw_course_name" | "reporting_year">) {
  return `/projects/${routeYear(project.reporting_year)}/${buildProjectSlug(project.raw_course_name)}`;
}

export function resolveProjectFromRoute(
  snapshot: AnalyticsSnapshot,
  reportingYearParam: string | undefined,
  projectSlugParam: string | undefined,
) {
  if (!reportingYearParam || !projectSlugParam) return null;

  return snapshot.canonicalProjects.find((project) => {
    const projectYear = routeYear(project.reporting_year);
    return projectYear === reportingYearParam && buildProjectSlug(project.raw_course_name) === projectSlugParam;
  }) || null;
}

