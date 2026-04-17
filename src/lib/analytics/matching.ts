import { COURSE_LIKE_KEYWORDS, OPERATIONAL_KEYWORDS } from "@/lib/analytics/constants";
import type { CanonicalProject, MatchSuggestion } from "@/lib/analytics/types";
import { normalizeTextPreserveMeaning } from "@/lib/analytics/normalization";

function tokenize(value: string) {
  return normalizeTextPreserveMeaning(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function jaccardSimilarity(aTokens: string[], bTokens: string[]) {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  const intersection = [...aSet].filter((token) => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function charSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / Math.max(a.length, b.length, 1);
}

export function isLikelyNonProjectWork(rawTitle: string, rawCategory: string) {
  const haystack = `${rawTitle} ${rawCategory}`.toLowerCase();
  return OPERATIONAL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function isLikelyCourseLikeWork(rawTitle: string, rawCategory: string) {
  if (!rawTitle.trim()) return false;
  const haystack = `${rawTitle} ${rawCategory}`.toLowerCase();
  if (isLikelyNonProjectWork(rawTitle, rawCategory)) return false;
  return COURSE_LIKE_KEYWORDS.some((keyword) => haystack.includes(keyword)) || /:/.test(rawTitle);
}

export function scoreProjectSuggestion(
  sourceTitle: string,
  sourceCompact: string,
  inferredYear: string | null,
  project: CanonicalProject,
) {
  const sourceTokens = tokenize(sourceTitle);
  const targetTokens = tokenize(project.normalized_course_name);
  const tokenScore = jaccardSimilarity(sourceTokens, targetTokens);
  const charScore = charSimilarity(sourceCompact, project.compact_course_name);
  const yearScore = inferredYear && project.reporting_year
    ? inferredYear === project.reporting_year
      ? 1
      : Math.abs(Number(inferredYear) - Number(project.reporting_year)) === 1
        ? 0.5
        : 0
    : 0;

  return 0.55 * tokenScore + 0.35 * charScore + 0.1 * yearScore;
}

export function buildProjectSuggestion(
  sourceTitle: string,
  sourceCompact: string,
  inferredYear: string | null,
  candidates: CanonicalProject[],
): MatchSuggestion | null {
  const filtered = candidates
    .map((project) => ({
      project,
      score: scoreProjectSuggestion(sourceTitle, sourceCompact, inferredYear, project),
    }))
    .filter((entry) => entry.score >= 0.85)
    .sort((a, b) => b.score - a.score || a.project.project_key.localeCompare(b.project.project_key));

  if (filtered.length === 0) return null;

  const [best, next] = filtered;
  const clearMargin = !next || best.score - next.score >= 0.03;
  const confidence = best.score >= 0.93 && clearMargin ? "high" : "medium";

  return {
    target_project_key: best.project.project_key,
    candidate_title: best.project.raw_course_name,
    score: Math.round(best.score * 1000) / 1000,
    confidence,
  };
}
