import type { NavigateFunction } from "react-router-dom";

export type ProjectFilterParams = Record<string, string | string[] | null | undefined>;

export function getChartPayloadValue(payload: unknown, key: string) {
  const record = payload as Record<string, unknown> | null;
  const nested = record?.payload as Record<string, unknown> | null | undefined;
  const value = nested?.[key] ?? record?.[key];
  return value === undefined || value === null ? "" : String(value);
}

export function buildProjectsPath(params: ProjectFilterParams = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .forEach((entry) => searchParams.append(key, entry));
  });

  const search = searchParams.toString();
  return search ? `/projects?${search}` : "/projects";
}

export function navigateToProjectsFromChart(navigate: NavigateFunction, params: ProjectFilterParams) {
  navigate(buildProjectsPath(params));
}
