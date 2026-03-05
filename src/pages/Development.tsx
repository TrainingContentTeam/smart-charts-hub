import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects, useTimeEntries } from "@/hooks/use-time-data";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { isCompletedProjectStatus, normalizeProjectStatus } from "@/lib/project-status";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  ComposedChart,
  Legend,
} from "recharts";

function clean(v: unknown): string {
  return String(v || "").trim();
}

function isMissingMeta(v: unknown): boolean {
  const s = clean(v).toLowerCase();
  return !s || ["n/a", "na", "n.a.", "none", "unknown", "null", "-", "--"].includes(s);
}

function normalizeCourseType(v: unknown): string {
  const s = clean(v).toLowerCase();
  if (isMissingMeta(v)) return "Missing";
  if (s.startsWith("new")) return "New";
  if (s.startsWith("revamp")) return "Revamp";
  if (s.startsWith("maint")) return "Maintenance";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeTool(v: unknown): string {
  const s = clean(v).toLowerCase();
  if (isMissingMeta(v)) return "Unknown";
  if (s.includes("storyline")) return "Storyline";
  if (s === "rise" || s.includes("articulate rise")) return "Rise";
  if (s.includes("lms")) return "LMS";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function personKey(v: unknown): string {
  return clean(v).toLowerCase().replace(/\s+/g, " ");
}

function normalizeMetaLabel(v: unknown): string {
  if (isMissingMeta(v)) return "Unknown";
  return clean(v);
}

const LP_DEV_STATUSES = new Set([
  "lp outline development",
  "lp development",
  "id review of lp",
  "lp peer review",
]);

const TESTING_READY_STATUSES = new Set([
  "testing",
  "testing revisions",
  "ready to load",
  "ready to publish",
]);

function bucketStatus(status: unknown): "not_started" | "lp_dev" | "testing_ready" | "other" | "complete" {
  const normalized = normalizeProjectStatus(status, "Unknown").toLowerCase();
  if (isCompletedProjectStatus(normalized)) return "complete";
  if (normalized === "not started") return "not_started";
  if (LP_DEV_STATUSES.has(normalized)) return "lp_dev";
  if (TESTING_READY_STATUSES.has(normalized)) return "testing_ready";
  return "other";
}

const TREND_TOOL_OPTIONS = ["Rise", "Storyline", "LMS"] as const;
const TREND_TYPE_OPTIONS = ["New", "Revamp", "Maintenance"] as const;
const TREND_VERTICAL_OPTIONS = ["P1A", "EMS1", "FR1A", "D1A", "C1A", "LGU", "Wellness", "Other"] as const;
type ChartFilters = {
  reportingYear: string;
  type: string;
  tool: string;
  vertical: string;
  assignedId: string;
};

const DEFAULT_CHART_FILTERS: ChartFilters = {
  reportingYear: "all",
  type: "all",
  tool: "all",
  vertical: "all",
  assignedId: "all",
};

export default function Development() {
  const { data: projects = [] } = useProjects();
  const { data: entries = [] } = useTimeEntries();

  const [statusFilters, setStatusFilters] = useState<ChartFilters>({ ...DEFAULT_CHART_FILTERS });
  const [trendFilters, setTrendFilters] = useState<ChartFilters>({ ...DEFAULT_CHART_FILTERS });
  const [categoryFilters, setCategoryFilters] = useState<ChartFilters>({ ...DEFAULT_CHART_FILTERS });
  const [assignedFocusFilters, setAssignedFocusFilters] = useState<ChartFilters>({ ...DEFAULT_CHART_FILTERS });
  const [topProjectsFilters, setTopProjectsFilters] = useState<ChartFilters>({ ...DEFAULT_CHART_FILTERS });
  const [expandedTopProjectKey, setExpandedTopProjectKey] = useState<string | null>(null);
  const [showChartData, setShowChartData] = useState<Record<string, boolean>>({});

  const isDataVisible = (key: string) => !!showChartData[key];
  const toggleDataVisible = (key: string) => setShowChartData((prev) => ({ ...prev, [key]: !prev[key] }));

  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);

  const statusCounts = useMemo(() => {
    const numericYears = projects
      .map((p: any) => Number.parseInt(clean(p.reporting_year), 10))
      .filter((y) => Number.isFinite(y));
    const currentYear = numericYears.length ? Math.max(...numericYears) : null;
    const priorYear = currentYear ? currentYear - 1 : null;

    const map: Record<string, { current: number; prior: number; total: number }> = {};
    projects.forEach((p: any) => {
      if (isCompletedProjectStatus(p.status)) return;
      const year = Number.parseInt(clean(p.reporting_year), 10);
      if (!Number.isFinite(year) || !currentYear) return;
      if (year !== currentYear && (!priorYear || year !== priorYear)) return;

      const status = normalizeProjectStatus(p.status, "Unknown");
      if (!map[status]) map[status] = { current: 0, prior: 0, total: 0 };
      if (year === currentYear) map[status].current += 1;
      else map[status].prior += 1;
      map[status].total += 1;
    });

    const rows = Object.entries(map)
      .map(([status, counts]) => ({ status, ...counts }))
      .sort((a, b) => b.total - a.total || a.status.localeCompare(b.status));

    return { currentYear, priorYear, rows };
  }, [projects]);
  const maxStatusCount = Math.max(1, ...statusCounts.rows.map((s) => s.total));

  const currentYearAssignedBreakdown = useMemo(() => {
    const numericYears = projects
      .map((p: any) => Number.parseInt(clean(p.reporting_year), 10))
      .filter((y) => Number.isFinite(y));
    const currentYear = numericYears.length ? Math.max(...numericYears) : null;
    const map: Record<string, { not_started: number; lp_dev: number; testing_ready: number; other: number; complete: number; total: number }> = {};

    projects.forEach((p: any) => {
      const year = Number.parseInt(clean(p.reporting_year), 10);
      if (!Number.isFinite(year) || !currentYear || year !== currentYear) return;
      const id = normalizeMetaLabel(p.id_assigned);
      if (!map[id]) {
        map[id] = { not_started: 0, lp_dev: 0, testing_ready: 0, other: 0, complete: 0, total: 0 };
      }
      const bucket = bucketStatus(p.status);
      map[id][bucket] += 1;
      map[id].total += 1;
    });

    const rows = Object.entries(map)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));

    return { currentYear, rows };
  }, [projects]);

  const activeBacklogByYear = useMemo(() => {
    const rows = (projects as any[]).filter((p: any) => matchesFilters(p, statusFilters));
    const activeRows = rows.filter((p: any) => !isCompletedProjectStatus(p.status));
    const numericYears = activeRows
      .map((p: any) => Number.parseInt(clean(p.reporting_year), 10))
      .filter((y) => Number.isFinite(y));
    const currentYear = numericYears.length ? Math.max(...numericYears) : null;
    const priorYear = currentYear ? currentYear - 1 : null;

    const byType: Record<string, { current: number; carryover: number }> = {};
    TREND_TYPE_OPTIONS.forEach((type) => {
      byType[type] = { current: 0, carryover: 0 };
    });

    activeRows.forEach((p: any) => {
      const type = normalizeCourseType(p.course_type);
      if (!(type in byType)) return;
      const year = Number.parseInt(clean(p.reporting_year), 10);
      if (!Number.isFinite(year)) return;
      if (currentYear && year === currentYear) byType[type].current += 1;
      else if (priorYear && year === priorYear) byType[type].carryover += 1;
    });

    const data = TREND_TYPE_OPTIONS.map((type) => {
      const current = byType[type].current;
      const carryover = byType[type].carryover;
      return {
        category: type,
        current,
        carryover,
        total: current + carryover,
      };
    }).filter((row) => row.total > 0);

    return {
      currentYear,
      priorYear,
      data,
    };
  }, [projects, statusFilters]);

  function matchesFilters(project: any, filters: ChartFilters): boolean {
    const reportingYear = clean(project.reporting_year || "");
    const tool = normalizeTool(project.authoring_tool);
    const courseType = normalizeCourseType(project.course_type);

    if (filters.reportingYear !== "all" && reportingYear !== filters.reportingYear) return false;
    if (filters.tool !== "all" && tool !== filters.tool) return false;
    if (filters.type !== "all" && courseType !== filters.type) return false;
    if (filters.vertical !== "all") {
      const verticalText = clean(project.vertical).toLowerCase();
      if (!verticalText.includes(filters.vertical.toLowerCase())) return false;
    }
    if (filters.assignedId !== "all" && normalizeMetaLabel(project.id_assigned) !== filters.assignedId) return false;
    return true;
  }

  const hoursTrend = useMemo(() => {
    const yearlyHours: Record<string, number> = {};
    const yearlyCourses: Record<string, number> = {};

    projects.forEach((p: any) => {
      const year = clean(p.reporting_year || "Unknown");
      if (!matchesFilters(p, trendFilters)) return;

      yearlyCourses[year] = (yearlyCourses[year] || 0) + 1;
      yearlyHours[year] = (yearlyHours[year] || 0) + Number(p.total_hours || 0);
    });

    const yearsSet = new Set<string>([...Object.keys(yearlyHours), ...Object.keys(yearlyCourses)]);
    return [...yearsSet]
      .map((year) => ({
        year,
        hours: Math.round((yearlyHours[year] || 0) * 10) / 10,
        courses: yearlyCourses[year] || 0,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [projects, trendFilters]);

  const trendAssignedIdOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => set.add(normalizeMetaLabel(p.id_assigned)));
    return [...set].sort();
  }, [projects]);
  const reportingYearOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      const y = clean(p.reporting_year);
      if (y) set.add(y);
    });
    return [...set].sort();
  }, [projects]);

  const categoryHours = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e: any) => {
      const project = projectMap.get(e.project_id);
      if (!project) return;
      if (!matchesFilters(project, categoryFilters)) return;
      const category = clean(e.category || e.phase || "Uncategorized");
      map[category] = (map[category] || 0) + Number(e.hours || 0);
    });
    return Object.entries(map)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 14);
  }, [entries, projectMap, categoryFilters]);

  const topProjects = useMemo(() => {
    const rows = (projects as any[]).filter((p: any) => matchesFilters(p, topProjectsFilters));
    return [...rows]
      .sort((a: any, b: any) => Number(b.total_hours || 0) - Number(a.total_hours || 0))
      .slice(0, 12)
      .map((p: any, idx: number) => ({
        key: clean(p.id) || `${clean(p.name)}-${idx}`,
        name: clean(p.name) || "Untitled Course",
        hours: Math.round(Number(p.total_hours || 0) * 10) / 10,
        assignedId: normalizeMetaLabel(p.id_assigned),
        vertical: normalizeMetaLabel(p.vertical),
        type: normalizeCourseType(p.course_type),
        style: normalizeMetaLabel(p.course_style),
        courseLength: normalizeMetaLabel(p.course_length),
        tool: normalizeTool(p.authoring_tool),
        sme: normalizeMetaLabel(p.sme),
      }));
  }, [projects, topProjectsFilters]);

  const assignedIdFocus = useMemo(() => {
    const rows = (projects as any[]).filter((p: any) => matchesFilters(p, assignedFocusFilters));
    const projectToId = new Map<string, string>();
    const projectToIdKey = new Map<string, string>();
    const byId: Record<string, { courses: number; entryHours: number }> = {};

    rows.forEach((p: any) => {
      const id = clean(p.id_assigned);
      const projectId = clean(p.id);
      if (!id || !projectId) return;
      projectToId.set(projectId, id);
      projectToIdKey.set(projectId, personKey(id));
      if (!byId[id]) byId[id] = { courses: 0, entryHours: 0 };
      byId[id].courses += 1;
    });

    entries.forEach((e: any) => {
      const projectId = clean(e.project_id);
      const id = projectToId.get(projectId);
      if (!id) return;
      // Count only time entered by the assigned ID on their own assigned projects.
      if (personKey(e.user_name) !== projectToIdKey.get(projectId)) return;
      byId[id].entryHours += Number(e.hours || 0);
    });

    return Object.entries(byId)
      .map(([id, data]) => ({
        id,
        courses: data.courses,
        entryHours: Math.round(data.entryHours * 10) / 10,
      }))
      .sort((a, b) => b.entryHours - a.entryHours || b.courses - a.courses)
      .slice(0, 20);
  }, [projects, entries, assignedFocusFilters]);

  const renderFilterControls = (
    filters: ChartFilters,
    setFilters: Dispatch<SetStateAction<ChartFilters>>
  ) => (
    <div className="space-y-2 py-1">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Course Type</span>
          <Badge
            variant={filters.type === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilters((prev) => ({ ...prev, type: "all" }))}
          >
            All Types
          </Badge>
          {TREND_TYPE_OPTIONS.map((value) => (
            <Badge
              key={value}
              variant={filters.type === value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilters((prev) => ({ ...prev, type: value }))}
            >
              {value}
            </Badge>
          ))}
        </div>
        <div className="hidden h-6 w-px bg-border md:block" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Authoring Tool</span>
          <Badge
            variant={filters.tool === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilters((prev) => ({ ...prev, tool: "all" }))}
          >
            All Tools
          </Badge>
          {TREND_TOOL_OPTIONS.map((value) => (
            <Badge
              key={value}
              variant={filters.tool === value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilters((prev) => ({ ...prev, tool: value }))}
            >
              {value}
            </Badge>
          ))}
        </div>
      </div>

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
                {reportingYearOptions.map((year) => (
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
                {TREND_VERTICAL_OPTIONS.map((vertical) => (
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
                {trendAssignedIdOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Development</h1>
        <p className="text-muted-foreground">Build-cycle effort, throughput, and workload distribution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Courses by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {statusCounts.currentYear
                ? `${statusCounts.currentYear} + ${statusCounts.priorYear ?? "prior"}`
                : "No reporting year data"}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-primary" />
                Current Year
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-primary/40" />
                Prior Year
              </span>
            </div>
            {statusCounts.rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No non-completed statuses found.</p>
            ) : (
              statusCounts.rows.map((row) => (
                <div key={row.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.status}</span>
                    <span className="font-medium">
                      {row.total} ({row.current}/{row.prior})
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="flex h-full overflow-hidden rounded-full">
                      {row.current > 0 && (
                        <div
                          className="bg-primary"
                          style={{ width: `${Math.max(2, Math.round((row.current / maxStatusCount) * 100))}%` }}
                        />
                      )}
                      {row.prior > 0 && (
                        <div
                          className="bg-primary/40"
                          style={{ width: `${Math.max(2, Math.round((row.prior / maxStatusCount) * 100))}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current Year Courses by Assigned ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {currentYearAssignedBreakdown.currentYear
                ? `${currentYearAssignedBreakdown.currentYear} reporting year`
                : "No reporting year data"}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-500" />Not Started</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />LP Work</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-yellow-500" />Testing/Ready</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500" />Other</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Completed/Published</span>
            </div>
            {currentYearAssignedBreakdown.rows.map((row) => (
              <div key={row.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.id}</span>
                  <span className="font-medium">{row.total}</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  {row.not_started > 0 && (
                    <div className="bg-slate-500" style={{ width: `${(row.not_started / row.total) * 100}%` }} />
                  )}
                  {row.lp_dev > 0 && (
                    <div className="bg-red-500" style={{ width: `${(row.lp_dev / row.total) * 100}%` }} />
                  )}
                  {row.testing_ready > 0 && (
                    <div className="bg-yellow-500" style={{ width: `${(row.testing_ready / row.total) * 100}%` }} />
                  )}
                  {row.other > 0 && (
                    <div className="bg-blue-500" style={{ width: `${(row.other / row.total) * 100}%` }} />
                  )}
                  {row.complete > 0 && (
                    <div className="bg-emerald-500" style={{ width: `${(row.complete / row.total) * 100}%` }} />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Active Backlog by Course Type</CardTitle>
            <ChartActions
              showData={isDataVisible("dev-status")}
              onToggleData={() => toggleDataVisible("dev-status")}
              onSnapshot={() => saveChartSnapshot("chart-dev-status", "development-active-backlog")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Includes only courses whose Status is not Completed/Published. Bars are stacked by current-year active and prior-year carryover.
          </p>
          {renderFilterControls(statusFilters, setStatusFilters)}
        </CardHeader>
        <CardContent>
          <div id="chart-dev-status" className="space-y-3">
            {activeBacklogByYear.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active courses found for the selected filters.</p>
            ) : (
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeBacklogByYear.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="category" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(v: any, _n: any, item: any) =>
                        item?.dataKey === "carryover"
                          ? [v, `${activeBacklogByYear.priorYear ?? "Prior Year"} Carryover`]
                          : [v, `${activeBacklogByYear.currentYear ?? "Current Year"} Active`]
                      }
                    />
                    <Legend />
                    <Bar
                      dataKey="current"
                      name={`${activeBacklogByYear.currentYear ?? "Current Year"} Active`}
                      stackId="active-stack"
                      fill="hsl(var(--chart-1))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="carryover"
                      name={`${activeBacklogByYear.priorYear ?? "Prior Year"} Carryover`}
                      stackId="active-stack"
                      fill="hsl(var(--chart-4))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {isDataVisible("dev-status") && (
              <ChartDataTable
                rows={activeBacklogByYear.data}
                columns={[
                  { key: "category", label: "Category" },
                  { key: "current", label: `${activeBacklogByYear.currentYear ?? "Current Year"} Active` },
                  { key: "carryover", label: `${activeBacklogByYear.priorYear ?? "Prior Year"} Carryover` },
                  { key: "total", label: "Total Active" },
                ]}
              />
            )}
            {activeBacklogByYear.data.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Carryover indicates active courses from {activeBacklogByYear.priorYear ?? "the prior year"}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Total Development Hours by Year</CardTitle>
            <ChartActions
              showData={isDataVisible("dev-trend")}
              onToggleData={() => toggleDataVisible("dev-trend")}
              onSnapshot={() => saveChartSnapshot("chart-dev-trend", "development-hours-trend")}
            />
          </div>
          {renderFilterControls(trendFilters, setTrendFilters)}
        </CardHeader>
        <CardContent>
          <div id="chart-dev-trend" className="space-y-3">
            {hoursTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No entries match the current filter selection.
              </p>
            ) : (
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={hoursTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" />
                    <YAxis yAxisId="left" allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v: any) => `${v}h`} />
                    <Tooltip
                      formatter={(v: any, _n: any, item: any) =>
                        item?.dataKey === "courses"
                          ? [v, "Course Count"]
                          : [`${v}h`, "Development Hours"]
                      }
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="courses"
                      name="Course Count"
                      fill="hsl(var(--chart-3))"
                      opacity={0.35}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="hours"
                      name="Development Hours"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            {isDataVisible("dev-trend") && (
              <ChartDataTable
                rows={hoursTrend}
                columns={[
                  { key: "year", label: "Year" },
                  { key: "courses", label: "Course Count" },
                  { key: "hours", label: "Development Hours" },
                ]}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Hours by Development Category</CardTitle>
            <ChartActions
              showData={isDataVisible("dev-category")}
              onToggleData={() => toggleDataVisible("dev-category")}
              onSnapshot={() => saveChartSnapshot("chart-dev-category", "development-hours-by-category")}
            />
          </div>
          {renderFilterControls(categoryFilters, setCategoryFilters)}
        </CardHeader>
        <CardContent>
          <div id="chart-dev-category" className="space-y-3">
            {categoryHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries match the current filter selection.</p>
            ) : (
              <div className="h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryHours} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={220} />
                    <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} />
                    <Bar dataKey="hours" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {isDataVisible("dev-category") && <ChartDataTable rows={categoryHours} columns={[{ key: "name", label: "Category" }, { key: "hours", label: "Hours" }]} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Assigned ID Focus</CardTitle>
            <ChartActions
              showData={isDataVisible("dev-assigned-id")}
              onToggleData={() => toggleDataVisible("dev-assigned-id")}
              onSnapshot={() => saveChartSnapshot("chart-dev-assigned-id", "development-assigned-id-focus")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Uses time-entry hours only from projects assigned to each ID.
          </p>
          {renderFilterControls(assignedFocusFilters, setAssignedFocusFilters)}
        </CardHeader>
        <CardContent>
          <div id="chart-dev-assigned-id" className="space-y-3">
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={assignedIdFocus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="id" interval={0} angle={-20} textAnchor="end" height={80} />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: any) => `${v}h`} />
                  <Tooltip
                    formatter={(v: any, _n: any, item: any) =>
                      item?.dataKey === "courses" ? [v, "Courses"] : [`${v}h`, "Hours Entered"]
                    }
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="courses" name="Courses" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="entryHours" name="Hours Entered" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("dev-assigned-id") && (
              <ChartDataTable
                rows={assignedIdFocus}
                columns={[
                  { key: "id", label: "Assigned ID" },
                  { key: "entryHours", label: "Entry Hours" },
                  { key: "courses", label: "Courses" },
                ]}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Top Projects by Total Hours</CardTitle>
          {renderFilterControls(topProjectsFilters, setTopProjectsFilters)}
        </CardHeader>
        <CardContent className="space-y-2">
          {topProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects available for the selected years.</p>
          ) : (
            topProjects.map((project, idx) => (
              <div
                key={project.key}
                className={`rounded-md border text-sm transition-all ${expandedTopProjectKey === project.key ? "bg-muted/40 shadow-sm" : "bg-background"}`}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                  onClick={() =>
                    setExpandedTopProjectKey((prev) => (prev === project.key ? null : project.key))
                  }
                >
                  <span className="truncate pr-4">{idx + 1}. {project.name}</span>
                  <span className="font-semibold">{project.hours}h</span>
                </button>
                {expandedTopProjectKey === project.key && (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 px-3 pb-3 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p><span className="font-medium text-foreground">Course:</span> {project.name}</p>
                    <p><span className="font-medium text-foreground">ID:</span> {project.assignedId}</p>
                    <p><span className="font-medium text-foreground">Vertical:</span> {project.vertical}</p>
                    <p><span className="font-medium text-foreground">Type:</span> {project.type}</p>
                    <p><span className="font-medium text-foreground">Style:</span> {project.style}</p>
                    <p><span className="font-medium text-foreground">Course Length:</span> {project.courseLength}</p>
                    <p><span className="font-medium text-foreground">Tool:</span> {project.tool}</p>
                    <p><span className="font-medium text-foreground">SME:</span> {project.sme}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
