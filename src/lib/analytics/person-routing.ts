import { normalizePersonName, splitMultiValueField } from "@/lib/analytics/normalization";
import type { AnalyticsSnapshot } from "@/lib/analytics/types";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "person"
  );
}

function addName(target: Set<string>, value: string | null | undefined) {
  const normalized = normalizePersonName(value);
  if (normalized) target.add(normalized);
}

function collectPersonNames(snapshot: AnalyticsSnapshot) {
  const names = new Set<string>();

  snapshot.dimPerson.forEach((person) => addName(names, person.canonical_name));

  snapshot.canonicalProjects.forEach((project) => {
    project.owner_names.forEach((owner) => addName(names, owner));
    splitMultiValueField(project.sme_assigned_raw).forEach((name) => addName(names, name));
  });

  snapshot.timeLogs.forEach((row) => {
    if (row.role_group === "ID" || row.role_group === "SME") {
      addName(names, row.canonical_user_name);
    }
  });

  snapshot.smeFeedbackIdView.forEach((row) => {
    addName(names, row.instructional_designer);
    addName(names, row.sme);
  });

  snapshot.smeFeedbackSmeView.forEach((row) => {
    addName(names, row.instructional_designer);
    addName(names, row.sme);
  });

  return [...names].sort((a, b) => a.localeCompare(b));
}

export function buildPersonSlug(personName: string) {
  return slugify(normalizePersonName(personName));
}

export function buildPersonDetailPath(personName: string) {
  return `/people/${buildPersonSlug(personName)}`;
}

export function resolvePersonNameFromRoute(snapshot: AnalyticsSnapshot, personSlugParam: string | undefined) {
  if (!personSlugParam) return null;

  return (
    collectPersonNames(snapshot).find((name) => buildPersonSlug(name) === personSlugParam) || null
  );
}
