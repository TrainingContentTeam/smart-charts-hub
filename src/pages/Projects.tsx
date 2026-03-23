import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSmeSurveys, useTimeEntries, useProjects } from "@/hooks/use-time-data";
import { isCompletedProjectStatus } from "@/lib/project-status";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, ArrowUpDown, BookOpen, Video, Clock3, CalendarDays, Ruler, ChevronDown } from "lucide-react";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";
import { useSearchParams } from "react-router-dom";

function text(v: unknown): string {
  return String(v || "").trim();
}

function number(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function prettyLabel(label: string) {
  return label
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

function normProjectTitle(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

function reportingYearNumber(value: unknown): number | null {
  const match = text(value).match(/^\d{4}$/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
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

type ProjectFilters = {
  year: string;
  status: string;
  type: string;
  tool: string;
  vertical: string;
  assignedId: string;
  length: string;
  source: string;
  completion: "all" | "completed" | "not_completed";
};

const DEFAULT_FILTERS: ProjectFilters = {
  year: "all",
  status: "all",
  type: "all",
  tool: "all",
  vertical: "all",
  assignedId: "all",
  length: "all",
  source: "all",
  completion: "all",
};

export default function Projects() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const { data: surveys = [] } = useSmeSurveys();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>({ ...DEFAULT_FILTERS });
  const [detailSortKey, setDetailSortKey] = useState<"category" | "hours" | "date" | "user">("date");
  const [detailSortAsc, setDetailSortAsc] = useState(false);
  const [showCategoryChartData, setShowCategoryChartData] = useState(false);
  const selectedProjectId = text(searchParams.get("project")) || null;

  const setSelectedProjectId = (projectId: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (projectId) nextParams.set("project", projectId);
    else nextParams.delete("project");
    setSearchParams(nextParams, { replace: true });
  };

  const projectsWithRelativePosition = useMemo(() => {
    const withMetrics = projects.map((p: any) => {
      const length = text(p.course_length || "Unknown");
      const cohort = projects
        .filter((x: any) => text(x.course_length || "Unknown") === length && isCompletedProjectStatus(x.status))
        .map((x: any) => number(x.total_hours));
      const sorted = [...cohort].sort((a, b) => a - b);
      const current = number(p.total_hours);
      const idx = sorted.findIndex((v) => v >= current);
      const rank = idx === -1 ? Math.max(sorted.length - 1, 0) : idx;
      const percentile =
        sorted.length > 1
          ? Math.round((rank / (sorted.length - 1)) * 100)
          : sorted.length === 1
            ? (current >= sorted[0] ? 100 : 0)
            : 0;

      return {
        ...p,
        totalHoursNum: current,
        cohortLengthLabel: length,
        cohortSize: sorted.length,
        percentile,
      };
    });

    return withMetrics;
  }, [projects]);

  const latestActivityByProjectId = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e: any) => {
      const projectId = text(e.project_id);
      if (!projectId) return;
      const dt = text(e.entry_date) || text(e.created_at);
      const ts = dt ? Date.parse(dt) : 0;
      if (!Number.isFinite(ts)) return;
      const prev = map.get(projectId) || 0;
      if (ts > prev) map.set(projectId, ts);
    });
    return map;
  }, [entries]);

  const filterOptions = useMemo(() => {
    const unique = (getter: (p: any) => string) =>
      [...new Set(projectsWithRelativePosition.map(getter).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      year: unique((p) => text(p.reporting_year || "Unknown")),
      status: unique((p) => text(p.status || "Unknown")),
      type: unique((p) => text(p.course_type || "Unknown")),
      tool: unique((p) => text(p.authoring_tool || "Unknown")),
      vertical: unique((p) => text(p.vertical || "Unknown")),
      assignedId: unique((p) => text(p.id_assigned || "Unknown")),
      length: unique((p) => text(p.course_length || "Unknown")),
      source: unique((p) => text(p.data_source || "Unknown")),
    };
  }, [projectsWithRelativePosition]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projectsWithRelativePosition
      .filter((p: any) => {
        if (q && !text(p.name).toLowerCase().includes(q)) return false;
        if (filters.year !== "all" && text(p.reporting_year || "Unknown") !== filters.year) return false;
        if (filters.status !== "all" && text(p.status || "Unknown") !== filters.status) return false;
        if (filters.type !== "all" && text(p.course_type || "Unknown") !== filters.type) return false;
        if (filters.tool !== "all" && text(p.authoring_tool || "Unknown") !== filters.tool) return false;
        if (filters.vertical !== "all" && text(p.vertical || "Unknown") !== filters.vertical) return false;
        if (filters.assignedId !== "all" && text(p.id_assigned || "Unknown") !== filters.assignedId) return false;
        if (filters.length !== "all" && text(p.course_length || "Unknown") !== filters.length) return false;
        if (filters.source !== "all" && text(p.data_source || "Unknown") !== filters.source) return false;
        if (filters.completion === "completed" && !isCompletedProjectStatus(p.status)) return false;
        if (filters.completion === "not_completed" && isCompletedProjectStatus(p.status)) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const aActivity = latestActivityByProjectId.get(a.id) || 0;
        const bActivity = latestActivityByProjectId.get(b.id) || 0;
        if (bActivity !== aActivity) return bActivity - aActivity;
        return b.totalHoursNum - a.totalHoursNum;
      });
  }, [projectsWithRelativePosition, search, filters, latestActivityByProjectId]);

  const selected = selectedProjectId
    ? projectsWithRelativePosition.find((p: any) => p.id === selectedProjectId)
    : null;

  const selectedEntries = selected?.id ? entries.filter((e: any) => e.project_id === selected.id) : [];

  const sortedSelectedEntries = useMemo(() => {
    const rows = [...selectedEntries];
    rows.sort((a: any, b: any) => {
      let cmp = 0;
      switch (detailSortKey) {
        case "category": cmp = text(a.category || a.phase).localeCompare(text(b.category || b.phase)); break;
        case "hours": cmp = number(a.hours) - number(b.hours); break;
        case "date": cmp = text(a.entry_date).localeCompare(text(b.entry_date)); break;
        case "user": cmp = text(a.user_name).localeCompare(text(b.user_name)); break;
      }
      return detailSortAsc ? cmp : -cmp;
    });
    return rows;
  }, [selectedEntries, detailSortKey, detailSortAsc]);

  const toggleDetailSort = (key: "category" | "hours" | "date" | "user") => {
    if (detailSortKey === key) setDetailSortAsc((v) => !v);
    else {
      setDetailSortKey(key);
      setDetailSortAsc(true);
    }
  };

  const categoryBreakdown = useMemo(() => {
    if (!selected) return [];
    const totalEffort = number((selected as any).total_hours);
    const rawMap: Record<string, number> = {};
    selectedEntries.forEach((e: any) => {
      const cat = text(e.category || e.phase || "Uncategorized");
      rawMap[cat] = (rawMap[cat] || 0) + number(e.hours);
    });
    const rawSum = Object.values(rawMap).reduce((a, b) => a + b, 0);
    if (rawSum === 0 && totalEffort === 0) return [];

    const result = Object.entries(rawMap).map(([name, rawHours]) => {
      const share = rawSum > 0 ? rawHours / rawSum : 0;
      const normalizedHours = totalEffort > 0 ? Math.round(share * totalEffort * 100) / 100 : Math.round(rawHours * 100) / 100;
      const pct = Math.round(share * 1000) / 10;
      return {
        name: name.length > 24 ? `${name.slice(0, 24)}...` : name,
        fullName: name,
        hours: normalizedHours,
        pct,
      };
    });

    // Add "Uncategorized" remainder if category sum < total effort
    if (totalEffort > 0 && rawSum < totalEffort) {
      const categorizedNormalized = result.reduce((a, b) => a + b.hours, 0);
      const remainder = Math.round((totalEffort - categorizedNormalized) * 100) / 100;
      if (remainder > 0.01) {
        const remainderPct = Math.round((remainder / totalEffort) * 1000) / 10;
        result.push({
          name: "Uncategorized",
          fullName: "Uncategorized",
          hours: remainder,
          pct: remainderPct,
        });
      }
    }

    return result.sort((a, b) => b.hours - a.hours);
  }, [selected, selectedEntries]);

  const priorYearVariants = useMemo(() => {
    if (!selected) return [];
    const currentYear = reportingYearNumber((selected as any).reporting_year);
    if (currentYear === null) return [];
    const currentNameKey = normProjectTitle((selected as any).name);

    return projectsWithRelativePosition
      .filter((project: any) => {
        if (project.id === (selected as any).id) return false;
        if (normProjectTitle(project.name) !== currentNameKey) return false;
        const year = reportingYearNumber(project.reporting_year);
        return year !== null && year < currentYear;
      })
      .sort((a: any, b: any) => {
        const yearDiff = number(b.reporting_year) - number(a.reporting_year);
        if (yearDiff !== 0) return yearDiff;
        return text(a.data_source).localeCompare(text(b.data_source));
      });
  }, [projectsWithRelativePosition, selected]);

  const metadataRows = useMemo(() => {
    if (!selected) return [];
    const fields = [
      "status",
      "reporting_year",
      "total_hours",
      "course_type",
      "authoring_tool",
      "course_style",
      "course_length",
      "vertical",
      "interaction_count",
      "id_assigned",
      "sme",
      "legal_reviewer",
      "data_source",
      "created_at",
      "updated_at",
    ];
    return fields.map((field) => ({ field, value: (selected as any)[field] }));
  }, [selected]);

  const matchedSurveys = useMemo(() => {
    if (!selected?.id) return [];
    return surveys.filter((survey: any) => text(survey.project_id) === selected.id);
  }, [selected, surveys]);

  const surveySummary = useMemo(() => {
    const billed = matchedSurveys.reduce((sum, row: any) => sum + number(row.amount_billed), 0);
    const hoursWorked = matchedSurveys.reduce((sum, row: any) => sum + number(row.hours_worked), 0);
    const avgSmeScore = average(matchedSurveys.flatMap((row: any) => collectScores(row, SME_SCORE_KEYS)));
    const avgIdScore = average(matchedSurveys.flatMap((row: any) => collectScores(row, ID_SCORE_KEYS)));
    return {
      responses: matchedSurveys.length,
      billed,
      hoursWorked,
      avgSmeScore,
      avgIdScore,
    };
  }, [matchedSurveys]);

  const surveyComments = useMemo(() => {
    return matchedSurveys
      .filter((row: any) => text(row.additional_feedback_sme) || text(row.additional_comments_id))
      .map((row: any) => ({
        id: text(row.id),
        surveyDate: text(row.survey_date),
        sme: text(row.sme) || "Unknown SME",
        instructionalDesigner: text(row.instructional_designer) || "Unknown ID",
        smeComment: text(row.additional_feedback_sme),
        idComment: text(row.additional_comments_id),
      }));
  }, [matchedSurveys]);

  const SortHead = ({ label, field }: { label: string; field: "category" | "hours" | "date" | "user" }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleDetailSort(field)}>
      <span className="flex items-center gap-1">
        {label} <ArrowUpDown className="h-3 w-3" />
      </span>
    </TableHead>
  );

  if (selected) {
    const m = selected as any;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedProjectId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{m.name}</h1>
            <p className="text-muted-foreground">
              {Math.round(number(m.total_hours) * 100) / 100} total hours · Reporting Year {text(m.reporting_year) || "Unknown"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Percentile vs Similar Length</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{m.percentile}th</p>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${m.percentile}%`,
                      background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(40 96% 58%), hsl(0 72% 51%))",
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Compared with {m.cohortSize} completed/published course(s) of length “{m.cohortLengthLabel}”.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{text(m.status) || "Unknown"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Time Entries</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{selectedEntries.length}</p></CardContent>
          </Card>
        </div>

        {priorYearVariants.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prior Year Variants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Earlier reporting-year versions of this same course title.
              </p>
              <div className="flex flex-wrap gap-2">
                {priorYearVariants.map((variant: any) => (
                  <Button
                    key={variant.id}
                    variant="outline"
                    className="h-auto items-start justify-start px-3 py-2 text-left"
                    onClick={() => setSelectedProjectId(variant.id)}
                  >
                    <span className="font-medium">{text(variant.reporting_year) || "Unknown Year"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {text(variant.data_source) || "Unknown source"} · {Math.round(number(variant.total_hours) * 100) / 100}h
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Course Metadata</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {metadataRows.map((row) => (
                <div key={row.field} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{prettyLabel(row.field)}</p>
                  <p className="text-sm font-medium break-words">{text(row.value) || "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Time Spent by Category</CardTitle>
              <ChartActions
                showData={showCategoryChartData}
                onToggleData={() => setShowCategoryChartData((v) => !v)}
                onSnapshot={() => saveChartSnapshot("chart-project-category", `project-${m.id}-category-hours`)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div id="chart-project-category" className="space-y-3">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={12} tickFormatter={(v: any) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={180} fontSize={11} />
                    <Tooltip formatter={(_v: any, _n: any, item: any) => {
                      const row = item?.payload;
                      return [`${row?.pct ?? 0}% (${row?.hours ?? 0}h)`, "Share of Total Effort"];
                    }} />
                    <Bar dataKey="pct" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {showCategoryChartData && <ChartDataTable rows={categoryBreakdown} columns={[{ key: "name", label: "Category" }, { key: "pct", label: "%" }, { key: "hours", label: "Hours" }]} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Time Entry Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead label="Category" field="category" />
                    <SortHead label="Hours" field="hours" />
                    <SortHead label="Date" field="date" />
                    <SortHead label="User" field="user" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSelectedEntries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{text(e.category || e.phase)}</TableCell>
                      <TableCell>{Math.round(number(e.hours) * 100) / 100}</TableCell>
                      <TableCell>{text(e.entry_date) || "—"}</TableCell>
                      <TableCell>{text(e.user_name) || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Matched Survey Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {matchedSurveys.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Responses</p>
                    <p className="text-2xl font-bold">{surveySummary.responses}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Avg SME Score</p>
                    <p className="text-2xl font-bold">{Math.round(surveySummary.avgSmeScore * 100) / 100 || "—"}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Avg ID Score</p>
                    <p className="text-2xl font-bold">{Math.round(surveySummary.avgIdScore * 100) / 100 || "—"}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Hours / Billed</p>
                    <p className="text-lg font-bold">
                      {Math.round(surveySummary.hoursWorked * 10) / 10}h / ${Math.round(surveySummary.billed * 100) / 100}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Survey Comments</p>
                    <p className="text-xs text-muted-foreground">Open-text feedback linked to this project only.</p>
                  </div>
                  {surveyComments.length > 0 ? (
                    <div className="space-y-3">
                      {surveyComments.map((comment) => (
                        <div key={comment.id} className="rounded-md border p-3 space-y-2">
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{comment.surveyDate || "Unknown date"}</span>
                            <span>{comment.sme}</span>
                            <span>{comment.instructionalDesigner}</span>
                          </div>
                          {comment.smeComment && (
                            <div>
                              <p className="text-xs text-muted-foreground">SME Comment</p>
                              <p className="text-sm">{comment.smeComment}</p>
                            </div>
                          )}
                          {comment.idComment && (
                            <div>
                              <p className="text-xs text-muted-foreground">Assigned ID Comment</p>
                              <p className="text-sm">{comment.idComment}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Matched survey rows exist for this project, but none include comments.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No survey rows are currently matched to this project.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">Course-level overview and relative time position by similar course length.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Filters</CardTitle>
            <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1">
                  {filtersExpanded ? "Collapse" : "Expand"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${filtersExpanded ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-1">
              <p className="text-xs text-muted-foreground">Project Name</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by project name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <FilterSelect label="Reporting Year" value={filters.year} onValueChange={(value) => setFilters((f) => ({ ...f, year: value }))} options={filterOptions.year} />
            <FilterSelect label="Assigned ID" value={filters.assignedId} onValueChange={(value) => setFilters((f) => ({ ...f, assignedId: value }))} options={filterOptions.assignedId} />
          </div>

          <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
            <CollapsibleContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <FilterSelect label="Status" value={filters.status} onValueChange={(value) => setFilters((f) => ({ ...f, status: value }))} options={filterOptions.status} />
                <FilterSelect label="Completion" value={filters.completion} onValueChange={(value) => setFilters((f) => ({ ...f, completion: value as ProjectFilters["completion"] }))} options={["completed", "not_completed"]} />
                <FilterSelect label="Course Type" value={filters.type} onValueChange={(value) => setFilters((f) => ({ ...f, type: value }))} options={filterOptions.type} />
                <FilterSelect label="Authoring Tool" value={filters.tool} onValueChange={(value) => setFilters((f) => ({ ...f, tool: value }))} options={filterOptions.tool} />
                <FilterSelect label="Course Length" value={filters.length} onValueChange={(value) => setFilters((f) => ({ ...f, length: value }))} options={filterOptions.length} />
                <FilterSelect label="Vertical" value={filters.vertical} onValueChange={(value) => setFilters((f) => ({ ...f, vertical: value }))} options={filterOptions.vertical} />
                <FilterSelect label="Data Source" value={filters.source} onValueChange={(value) => setFilters((f) => ({ ...f, source: value }))} options={filterOptions.source} />
              </div>
            </CollapsibleContent>
          </Collapsible>
          <div>
            <Button variant="outline" size="sm" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No projects found. Upload data to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((p: any) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSelectedProjectId(p.id)}
            >
              <CardHeader className="pb-1 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                      {/video/i.test(text(p.course_type)) || /single\\s*video/i.test(text(p.name)) ? (
                        <Video className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <CardTitle className="text-sm leading-tight">{p.name}</CardTitle>
                  </div>
                  <Badge variant={isCompletedProjectStatus(p.status) ? "default" : "secondary"} className="shrink-0 text-xs">
                    {text(p.status) || "Unknown"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" /> Total Time
                    </p>
                    <p className="text-2xl font-semibold">{Math.round(p.totalHoursNum * 100) / 100}h</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.percentile}%`,
                        background: "linear-gradient(90deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.85))",
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Relative effort: {p.percentile}% within {p.cohortSize} completed similar-length course{p.cohortSize === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Year: {text(p.reporting_year) || "Unknown"}
                  </Badge>
                  <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                    <Ruler className="h-3 w-3" /> Length: {text(p.course_length) || "Unknown"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder={`All ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
