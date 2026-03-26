import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";
import { CollaborationSurveyComingSoon } from "@/components/CollaborationSurveyComingSoon";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { useProjects, useSmeSurveys } from "@/hooks/use-time-data";

function text(v: unknown): string {
  return String(v || "").trim();
}

function toNumber(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectScores(row: any, keys: string[]): number[] {
  return keys
    .map((key) => Number(row[key]))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function normalizeVertical(value: unknown): string {
  const raw = text(value);
  return raw || "Unknown";
}

const SME_SCORE_KEYS = [
  "sme_overall_experience_score",
  "clarity_goals_score",
  "staff_responsiveness_score",
  "tools_resources_score",
  "training_support_score",
  "use_expertise_score",
  "incorporation_feedback_score",
  "autonomy_course_design_score",
  "feeling_valued_score",
  "recommend_lexipol_score",
];

const ID_SCORE_KEYS = [
  "id_overall_collaboration_score",
  "id_sme_knowledge_score",
  "id_responsiveness_score",
  "id_instructional_design_knowledge_score",
  "id_contribution_development_score",
  "id_openness_feedback_score",
  "id_deadlines_schedule_score",
  "id_overall_quality_score",
  "id_assistance_interactions_score",
];

const INTERNAL_FILTER_OPTIONS = ["Yes", "No", "Unknown"] as const;

type InternalFilterValue = "all" | (typeof INTERNAL_FILTER_OPTIONS)[number];

type SmeChartFilters = {
  reportingYear: string;
  vertical: string;
  assignedId: string;
  internal: InternalFilterValue;
};

const DEFAULT_SME_CHART_FILTERS: SmeChartFilters = {
  reportingYear: "all",
  vertical: "all",
  assignedId: "all",
  internal: "all",
};

function normalizeInternalStatus(value: unknown): Exclude<InternalFilterValue, "all"> {
  const raw = text(value).toLowerCase();
  if (!raw) return "Unknown";
  if (["yes", "y", "true", "1", "internal", "employee", "lexipol employee"].includes(raw)) return "Yes";
  if (["no", "n", "false", "0", "external", "contractor", "vendor", "not internal"].includes(raw)) return "No";
  return "Unknown";
}

function includesYear(value: string, candidate: unknown): boolean {
  if (value === "all") return true;
  return value === text(candidate);
}

function includesVertical(value: string, candidate: unknown): boolean {
  if (value === "all") return true;
  return value === normalizeVertical(candidate);
}

function includesId(value: string, candidate: unknown): boolean {
  if (value === "all") return true;
  return value === text(candidate);
}

function includesInternal(filterValue: InternalFilterValue, value: unknown): boolean {
  if (filterValue === "all") return true;
  return normalizeInternalStatus(value) === filterValue;
}

function isYesValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return text(value).toLowerCase() === "yes";
}

export default function SmeCollaboration() {
  const { data: projects = [] } = useProjects();
  const { data: surveys = [] } = useSmeSurveys();
  const [smeAuthoredFilters, setSmeAuthoredFilters] = useState<SmeChartFilters>({ ...DEFAULT_SME_CHART_FILTERS });
  const [surveyBySmeFilters, setSurveyBySmeFilters] = useState<SmeChartFilters>({ ...DEFAULT_SME_CHART_FILTERS });
  const [surveyByIdFilters, setSurveyByIdFilters] = useState<SmeChartFilters>({ ...DEFAULT_SME_CHART_FILTERS });
  const [mismatchFilters, setMismatchFilters] = useState<SmeChartFilters>({ ...DEFAULT_SME_CHART_FILTERS });
  const [commentsFilters, setCommentsFilters] = useState<SmeChartFilters>({ ...DEFAULT_SME_CHART_FILTERS });
  const [showChartData, setShowChartData] = useState<Record<string, boolean>>({});
  const isDataVisible = (key: string) => !!showChartData[key];
  const toggleDataVisible = (key: string) => setShowChartData((prev) => ({ ...prev, [key]: !prev[key] }));

  const projectById = useMemo(() => {
    const map = new Map<string, any>();
    projects.forEach((project: any) => map.set(project.id, project));
    return map;
  }, [projects]);

  const years = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      if (p.reporting_year) set.add(text(p.reporting_year));
    });
    surveys.forEach((s: any) => {
      if (s.reporting_year) set.add(text(s.reporting_year));
    });
    return [...set].sort();
  }, [projects, surveys]);

  const verticalOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => set.add(normalizeVertical(p.vertical)));
    return [...set].sort((a, b) => {
      if (a === "Unknown") return 1;
      if (b === "Unknown") return -1;
      return a.localeCompare(b);
    });
  }, [projects]);

  const allIds = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      const id = text(p.id_assigned);
      if (id) set.add(id);
    });
    surveys.forEach((s: any) => {
      const id = text(s.instructional_designer);
      if (id) set.add(id);
    });
    return [...set].sort();
  }, [projects, surveys]);

  const getSurveyProject = (row: any) => (row.project_id ? projectById.get(row.project_id) : null);

  const getSurveyAssignedId = (row: any) => {
    const project = getSurveyProject(row);
    return text(row.instructional_designer || project?.id_assigned);
  };

  const getSurveyVertical = (row: any) => {
    const project = getSurveyProject(row);
    return normalizeVertical(project?.vertical);
  };

  const renderFilterControls = (
    filters: SmeChartFilters,
    setFilters: Dispatch<SetStateAction<SmeChartFilters>>,
    options?: { includeInternal?: boolean }
  ) => (
    <div className="space-y-3 py-1">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Reporting Year</span>
          <div className="min-w-[160px]">
            <Select value={filters.reportingYear} onValueChange={(value) => setFilters((prev) => ({ ...prev, reportingYear: value }))}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="hidden h-6 w-px bg-border md:block" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Vertical</span>
          <div className="min-w-[180px]">
            <Select value={filters.vertical} onValueChange={(value) => setFilters((prev) => ({ ...prev, vertical: value }))}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All Verticals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verticals</SelectItem>
                {verticalOptions.map((vertical) => (
                  <SelectItem key={vertical} value={vertical}>
                    {vertical}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="hidden h-6 w-px bg-border md:block" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Assigned ID</span>
          <div className="min-w-[220px]">
            <Select value={filters.assignedId} onValueChange={(value) => setFilters((prev) => ({ ...prev, assignedId: value }))}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All IDs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All IDs</SelectItem>
                {allIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {options?.includeInternal ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Internal</span>
          <Badge
            variant={filters.internal === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilters((prev) => ({ ...prev, internal: "all" }))}
          >
            All
          </Badge>
          {INTERNAL_FILTER_OPTIONS.map((value) => (
            <Badge
              key={value}
              variant={filters.internal === value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilters((prev) => ({ ...prev, internal: value }))}
            >
              {value}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );

  const matchesProjectFilters = (project: any, filters: SmeChartFilters) => {
    if (!includesYear(filters.reportingYear, project.reporting_year)) return false;
    if (!includesVertical(filters.vertical, project.vertical)) return false;
    if (!includesId(filters.assignedId, project.id_assigned)) return false;
    return true;
  };

  const matchesSurveyFilters = (row: any, filters: SmeChartFilters) => {
    if (!includesYear(filters.reportingYear, row.reporting_year)) return false;
    if (!includesVertical(filters.vertical, getSurveyVertical(row))) return false;
    if (!includesId(filters.assignedId, getSurveyAssignedId(row))) return false;
    if (!includesInternal(filters.internal, row.internal)) return false;
    return true;
  };

  const coursesWithSme = useMemo(
    () => projects.filter((p: any) => text(p.sme).length > 0),
    [projects]
  );

  const smeTopContributors = useMemo(() => {
    const map: Record<string, { courses: number; contentHours: number }> = {};
    coursesWithSme
      .filter((p: any) => matchesProjectFilters(p, smeAuthoredFilters))
      .forEach((p: any) => {
        const sme = text(p.sme);
        if (!map[sme]) map[sme] = { courses: 0, contentHours: 0 };
        map[sme].courses += 1;
        map[sme].contentHours += Number(p.content_hours ?? 0);
      });
    return Object.entries(map)
      .map(([sme, data]) => ({
        sme,
        courses: data.courses,
        contentHours: round(data.contentHours),
      }))
      .sort((a, b) => b.contentHours - a.contentHours || b.courses - a.courses)
      .slice(0, 10);
  }, [coursesWithSme, smeAuthoredFilters]);

  const surveySummaryBySme = useMemo(() => {
    const map: Record<string, { responses: number; billed: number; hours: number; smeScores: number[] }> = {};
    surveys
      .filter((row: any) => matchesSurveyFilters(row, surveyBySmeFilters))
      .forEach((row: any) => {
        const key = text(row.sme) || "Unknown SME";
        if (!map[key]) map[key] = { responses: 0, billed: 0, hours: 0, smeScores: [] };
        map[key].responses += 1;
        map[key].billed += toNumber(row.amount_billed);
        map[key].hours += toNumber(row.hours_worked);
        map[key].smeScores.push(...collectScores(row, SME_SCORE_KEYS));
      });
    return Object.entries(map)
      .map(([sme, data]) => ({
        sme,
        responses: data.responses,
        avgSmeScore: round(average(data.smeScores), 2),
        billed: round(data.billed, 2),
        hoursWorked: round(data.hours, 1),
      }))
      .sort((a, b) => b.responses - a.responses || b.avgSmeScore - a.avgSmeScore)
      .slice(0, 20);
  }, [surveys, surveyBySmeFilters, projectById]);

  const surveySummaryById = useMemo(() => {
    const map: Record<string, { responses: number; idScores: number[]; promoterScores: number[]; realworldYes: number }> = {};
    surveys
      .filter((row: any) => matchesSurveyFilters(row, surveyByIdFilters))
      .forEach((row: any) => {
        const key = text(row.instructional_designer) || "Unknown ID";
        if (!map[key]) map[key] = { responses: 0, idScores: [], promoterScores: [], realworldYes: 0 };
        map[key].responses += 1;
        map[key].idScores.push(...collectScores(row, ID_SCORE_KEYS));
        if (Number.isFinite(Number(row.id_sme_promoter_score))) {
          map[key].promoterScores.push(Number(row.id_sme_promoter_score));
        }
        if (isYesValue(row.id_realworld_examples_included)) map[key].realworldYes += 1;
      });
    return Object.entries(map)
      .map(([instructionalDesigner, data]) => ({
        instructionalDesigner,
        responses: data.responses,
        avgIdScore: round(average(data.idScores), 2),
        avgPromoter: round(average(data.promoterScores), 2),
        realworldRate: data.responses > 0 ? round((data.realworldYes / data.responses) * 100, 1) : 0,
      }))
      .sort((a, b) => b.responses - a.responses || b.avgIdScore - a.avgIdScore)
      .slice(0, 20);
  }, [surveys, surveyByIdFilters, projectById]);

  const surveyComments = useMemo(() => {
    return surveys
      .filter((row: any) => matchesSurveyFilters(row, commentsFilters))
      .filter((row: any) => text(row.additional_feedback_sme) || text(row.additional_comments_id))
      .map((row: any) => ({
        course: text(row.course_name) || "Unknown Course",
        year: text(row.reporting_year),
        vertical: getSurveyVertical(row),
        sme: text(row.sme) || "Unknown SME",
        instructionalDesigner: text(row.instructional_designer) || "Unknown ID",
        internal: normalizeInternalStatus(row.internal),
        smeComment: text(row.additional_feedback_sme),
        idComment: text(row.additional_comments_id),
      }))
      .slice(0, 25);
  }, [surveys, commentsFilters, projectById]);

  const idMismatchRows = useMemo(() => {
    return surveys
      .filter((row: any) => matchesSurveyFilters(row, mismatchFilters))
      .map((row: any) => {
        const project = getSurveyProject(row);
        return {
          course: text(row.course_name),
          year: text(row.reporting_year),
          vertical: getSurveyVertical(row),
          internal: normalizeInternalStatus(row.internal),
          surveyId: text(row.instructional_designer),
          projectId: text(project?.id_assigned),
        };
      })
      .filter((row) => row.projectId && row.surveyId && row.projectId !== row.surveyId)
      .slice(0, 25);
  }, [surveys, mismatchFilters, projectById]);

  const hasAnySurveyComments = useMemo(
    () => surveys.some((row: any) => text(row.additional_feedback_sme) || text(row.additional_comments_id)),
    [surveys]
  );

  const hasAnyIdMismatches = useMemo(
    () =>
      surveys.some((row: any) => {
        const project = getSurveyProject(row);
        const surveyId = text(row.instructional_designer);
        const projectId = text(project?.id_assigned);
        return projectId && surveyId && projectId !== surveyId;
      }),
    [surveys, projectById]
  );

  const totalSmes = new Set(coursesWithSme.map((p: any) => text(p.sme))).size;
  const totalCourses = coursesWithSme.length;
  const totalHours = round(coursesWithSme.reduce((sum: number, p: any) => sum + toNumber(p.total_hours), 0));
  const surveyResponseCount = surveys.length;
  const avgSmeScore = round(average(surveys.flatMap((row: any) => collectScores(row, SME_SCORE_KEYS))), 2);
  const avgIdScore = round(average(surveys.flatMap((row: any) => collectScores(row, ID_SCORE_KEYS))), 2);
  const avgPromoter = round(
    average(
      surveys
        .map((row: any) => Number(row.id_sme_promoter_score))
        .filter((value) => Number.isFinite(value) && value > 0)
    ),
    2
  );
  const totalBilled = round(surveys.reduce((sum: number, row: any) => sum + toNumber(row.amount_billed), 0), 2);
  const avgHourlyRate = round(
    average(
      surveys
        .map((row: any) => Number(row.effective_hourly_rate))
        .filter((value) => Number.isFinite(value) && value > 0)
    ),
    2
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SME Collaboration</h1>
        <p className="text-muted-foreground">SME assignment visibility plus survey-backed collaboration, billing, and instructional designer insights.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">SMEs Represented</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalSmes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Courses With SME</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalCourses}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Authored Hours</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalHours}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Survey Responses</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{surveyResponseCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg SME Score</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{avgSmeScore || "-"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg ID Score</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{avgIdScore || "-"}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg ID Promoter</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{avgPromoter || "-"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Amount Billed</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">${totalBilled.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Hourly Rate</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{avgHourlyRate ? `$${avgHourlyRate}` : "-"}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Top Ten SME Contributors</CardTitle>
            <ChartActions
              showData={isDataVisible("sme-authored")}
              onToggleData={() => toggleDataVisible("sme-authored")}
              onSnapshot={() => saveChartSnapshot("chart-sme-authored", "top-ten-sme-contributors")}
            />
          </div>
          {renderFilterControls(smeAuthoredFilters, setSmeAuthoredFilters)}
        </CardHeader>
        <CardContent>
          <div id="chart-sme-authored" className="space-y-3">
            <div className="h-[560px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={smeTopContributors} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" xAxisId="left" />
                  <XAxis type="number" xAxisId="right" hide />
                  <YAxis type="category" dataKey="sme" width={230} interval={0} yAxisId="cat" />
                  <Tooltip
                    formatter={(value: any, _name: any, item: any) =>
                      item?.dataKey === "courses"
                        ? [value, "Courses"]
                        : [`${value}h`, "Content Hours"]
                    }
                  />
                  <Legend />
                  <Bar xAxisId="left" yAxisId="cat" dataKey="contentHours" name="Content Hours" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  <Line xAxisId="right" yAxisId="cat" type="monotone" dataKey="courses" name="Courses" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("sme-authored") && <ChartDataTable rows={smeTopContributors} columns={[{ key: "sme", label: "SME" }, { key: "contentHours", label: "Content Hours" }, { key: "courses", label: "Courses" }]} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Survey Summary by SME</CardTitle>
            <ChartActions
              showData={isDataVisible("survey-sme")}
              onToggleData={() => toggleDataVisible("survey-sme")}
              onSnapshot={() => saveChartSnapshot("chart-survey-sme", "survey-summary-by-sme")}
            />
          </div>
          {renderFilterControls(surveyBySmeFilters, setSurveyBySmeFilters, { includeInternal: true })}
        </CardHeader>
        <CardContent>
          <div id="chart-survey-sme" className="space-y-3">
            <div className="h-[520px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={surveySummaryBySme} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" xAxisId="left" />
                  <XAxis type="number" xAxisId="right" hide />
                  <YAxis type="category" dataKey="sme" width={230} interval={0} yAxisId="cat" />
                  <Tooltip />
                  <Legend />
                  <Bar xAxisId="left" yAxisId="cat" dataKey="avgSmeScore" name="Avg SME Score" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  <Line xAxisId="right" yAxisId="cat" type="monotone" dataKey="responses" name="Responses" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("survey-sme") && <ChartDataTable rows={surveySummaryBySme} columns={[{ key: "sme", label: "SME" }, { key: "responses", label: "Responses" }, { key: "avgSmeScore", label: "Avg SME Score" }, { key: "hoursWorked", label: "Hours Worked" }, { key: "billed", label: "Amount Billed" }]} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Instructional Designer Survey Summary</CardTitle>
            <ChartActions
              showData={isDataVisible("survey-id")}
              onToggleData={() => toggleDataVisible("survey-id")}
              onSnapshot={() => saveChartSnapshot("chart-survey-id", "instructional-designer-summary")}
            />
          </div>
          {renderFilterControls(surveyByIdFilters, setSurveyByIdFilters, { includeInternal: true })}
        </CardHeader>
        <CardContent>
          <div id="chart-survey-id" className="space-y-3">
            <div className="h-[520px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={surveySummaryById} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" xAxisId="left" />
                  <XAxis type="number" xAxisId="right" hide />
                  <YAxis type="category" dataKey="instructionalDesigner" width={230} interval={0} yAxisId="cat" />
                  <Tooltip />
                  <Legend />
                  <Bar xAxisId="left" yAxisId="cat" dataKey="avgIdScore" name="Avg ID Score" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  <Line xAxisId="right" yAxisId="cat" type="monotone" dataKey="avgPromoter" name="Avg Promoter" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("survey-id") && <ChartDataTable rows={surveySummaryById} columns={[{ key: "instructionalDesigner", label: "ID" }, { key: "responses", label: "Responses" }, { key: "avgIdScore", label: "Avg ID Score" }, { key: "avgPromoter", label: "Avg Promoter" }, { key: "realworldRate", label: "Realworld Yes %" }]} />}
          </div>
        </CardContent>
      </Card>

      {hasAnyIdMismatches && (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Instructional Designer Mismatches</CardTitle>
            {renderFilterControls(mismatchFilters, setMismatchFilters, { includeInternal: true })}
          </CardHeader>
          <CardContent>
            <ChartDataTable rows={idMismatchRows} columns={[{ key: "course", label: "Course" }, { key: "year", label: "Year" }, { key: "vertical", label: "Vertical" }, { key: "internal", label: "Internal" }, { key: "surveyId", label: "Survey ID" }, { key: "projectId", label: "Project ID Assigned" }]} />
          </CardContent>
        </Card>
      )}

      {hasAnySurveyComments ? (
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">Survey Comments</CardTitle>
            {renderFilterControls(commentsFilters, setCommentsFilters, { includeInternal: true })}
          </CardHeader>
          <CardContent>
            <ChartDataTable rows={surveyComments} columns={[{ key: "course", label: "Course" }, { key: "year", label: "Year" }, { key: "vertical", label: "Vertical" }, { key: "sme", label: "SME" }, { key: "instructionalDesigner", label: "ID" }, { key: "internal", label: "Internal" }, { key: "smeComment", label: "SME Comment" }, { key: "idComment", label: "ID Comment" }]} />
          </CardContent>
        </Card>
      ) : (
        <CollaborationSurveyComingSoon />
      )}
    </div>
  );
}
