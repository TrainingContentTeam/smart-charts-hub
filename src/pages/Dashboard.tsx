import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProjects } from "@/hooks/use-time-data";
import { YearPills } from "@/components/YearPills";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { isCompletedProjectStatus } from "@/lib/project-status";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { Clock3, CircleCheckBig, CircleDashed, FolderOpen } from "lucide-react";

const COLORS = [
  "hsl(142 71% 45%)",
  "hsl(35 92% 52%)",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function norm(s: string): string {
  return (s || "").trim();
}

function isMissingMeta(value: unknown): boolean {
  const s = norm(String(value || "")).toLowerCase();
  return !s || ["n/a", "na", "n.a.", "none", "unknown", "null", "-", "--"].includes(s);
}

function normalizeCourseType(value: unknown): string {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "Unknown";
  if (s.startsWith("new")) return "New";
  if (s.startsWith("revamp")) return "Revamp";
  if (s.startsWith("maint")) return "Maintenance";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeTool(value: unknown): string {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("storyline")) return "Storyline";
  if (s === "rise" || s.includes("articulate rise")) return "Rise";
  if (s.includes("lms")) return "LMS";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeStyle(value: unknown): string {
  const s = String(value || "").trim();
  if (!s) return "Unknown";
  return s;
}

function qualityTone(percent: number) {
  if (percent >= 90) {
    return {
      label: "High",
      dot: "bg-emerald-500",
      border: "border-emerald-300",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    };
  }
  if (percent >= 70) {
    return {
      label: "Medium",
      dot: "bg-amber-500",
      border: "border-amber-300",
      bg: "bg-amber-50",
      text: "text-amber-700",
    };
  }
  return {
    label: "Low",
    dot: "bg-red-500",
    border: "border-red-300",
    bg: "bg-red-50",
    text: "text-red-700",
  };
}

function byYears<T extends { reporting_year?: string }>(rows: T[], selectedYears: string[]): T[] {
  if (!selectedYears.length) return rows;
  return rows.filter((r) => selectedYears.includes(norm(String(r.reporting_year || ""))));
}

function ChartHeader({
  title,
  containerId,
  filename,
  showData,
  onToggleData,
}: {
  title: string;
  containerId: string;
  filename: string;
  showData: boolean;
  onToggleData: () => void;
}) {
  return (
    <CardHeader className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <ChartActions
          showData={showData}
          onToggleData={onToggleData}
          onSnapshot={() => saveChartSnapshot(containerId, filename)}
        />
      </div>
    </CardHeader>
  );
}

export default function Dashboard() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const [coursesPerYearYears, setCoursesPerYearYears] = useState<string[]>([]);
  const [avgBreakdownMode, setAvgBreakdownMode] = useState<"style" | "type" | "tool">("tool");
  const [avgActiveKeys, setAvgActiveKeys] = useState<string[]>([]);
  const [statusYears, setStatusYears] = useState<string[]>([]);
  const [typeYears, setTypeYears] = useState<string[]>([]);
  const [toolYears, setToolYears] = useState<string[]>([]);
  const [stackedYears, setStackedYears] = useState<string[]>([]);
  const [showChartData, setShowChartData] = useState<Record<string, boolean>>({});

  const isDataVisible = (key: string) => !!showChartData[key];
  const toggleDataVisible = (key: string) => {
    setShowChartData((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isLoading = projectsLoading;

  const years = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      if (p.reporting_year) set.add(norm(String(p.reporting_year)));
    });
    return [...set].sort();
  }, [projects]);

  const totalCourses = projects.length;
  const completeCourses = projects.filter((p: any) => isCompletedProjectStatus(p.status)).length;
  const activeCourses = totalCourses - completeCourses;
  const totalHours = projects.reduce((sum: number, p: any) => sum + Number(p.total_hours || 0), 0);

  const maxHours = Math.max(1, ...projects.map((p: any) => Number(p.total_hours || 0)));
  const avgProjectHours = projects.length ? totalHours / projects.length : 0;

  const gaugeCards = [
    {
      label: "Courses",
      value: totalCourses,
      icon: FolderOpen,
      percent: 100,
      sub: `${years.length} reporting year(s)`,
    },
    {
      label: "Development Hours",
      value: Math.round(totalHours * 100) / 100,
      icon: Clock3,
      percent: Math.min(100, (avgProjectHours / maxHours) * 100),
      sub: `Avg ${Math.round(avgProjectHours * 10) / 10}h / course`,
    },
    {
      label: "Completed",
      value: completeCourses,
      icon: CircleCheckBig,
      percent: totalCourses ? (completeCourses / totalCourses) * 100 : 0,
      sub: totalCourses ? `${Math.round((completeCourses / totalCourses) * 100)}% complete` : "No data",
    },
    {
      label: "Not Complete",
      value: activeCourses,
      icon: CircleDashed,
      percent: totalCourses ? (activeCourses / totalCourses) * 100 : 0,
      sub: totalCourses ? `${Math.round((activeCourses / totalCourses) * 100)}% not complete` : "No data",
    },
  ];

  const coursesPerYear = useMemo(() => {
    const map: Record<string, number> = {};
    byYears(projects as any[], coursesPerYearYears).forEach((p: any) => {
      const year = norm(String(p.reporting_year || ""));
      if (!year) return;
      map[year] = (map[year] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, coursesPerYearYears]);

  const avgDimensionOptions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      const label =
        avgBreakdownMode === "style"
          ? normalizeStyle(p.course_style)
          : avgBreakdownMode === "type"
            ? normalizeCourseType(p.course_type)
            : normalizeTool(p.authoring_tool);
      set.add(label);
    });
    return [...set].sort();
  }, [projects, avgBreakdownMode]);

  const effectiveAvgKeys = useMemo(() => {
    const filtered = avgActiveKeys.filter((k) => avgDimensionOptions.includes(k));
    if (filtered.length > 0) return filtered;
    return avgDimensionOptions.slice(0, 3);
  }, [avgActiveKeys, avgDimensionOptions]);

  const avgSeries = useMemo(
    () =>
      effectiveAvgKeys.map((label, i) => ({
        label,
        avgField: `avg_${i}`,
        countField: `count_${i}`,
        color: COLORS[i % COLORS.length],
      })),
    [effectiveAvgKeys]
  );

  const avgHoursByYear = useMemo(() => {
    const byYear = new Map<string, any>();
    const keyIndex = new Map(effectiveAvgKeys.map((k, i) => [k, i]));

    projects.forEach((p: any) => {
      const year = norm(String(p.reporting_year || ""));
      if (!year) return;
      const label =
        avgBreakdownMode === "style"
          ? normalizeStyle(p.course_style)
          : avgBreakdownMode === "type"
            ? normalizeCourseType(p.course_type)
            : normalizeTool(p.authoring_tool);
      const idx = keyIndex.get(label);
      if (idx === undefined) return;

      if (!byYear.has(year)) byYear.set(year, { name: year });
      const row = byYear.get(year);
      row[`sum_${idx}`] = (row[`sum_${idx}`] || 0) + Number(p.total_hours || 0);
      row[`n_${idx}`] = (row[`n_${idx}`] || 0) + 1;
    });

    const rows = [...byYear.values()].sort((a, b) => a.name.localeCompare(b.name));
    rows.forEach((row) => {
      effectiveAvgKeys.forEach((_, idx) => {
        const n = Number(row[`n_${idx}`] || 0);
        const sum = Number(row[`sum_${idx}`] || 0);
        row[`avg_${idx}`] = n ? Math.round((sum / n) * 10) / 10 : null;
        row[`count_${idx}`] = n;
      });
    });
    return rows;
  }, [projects, avgBreakdownMode, effectiveAvgKeys]);

  const toggleAvgKey = (key: string) => {
    setAvgActiveKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const filteredProjectsForStatus = useMemo(() => byYears(projects as any[], statusYears), [projects, statusYears]);
  const statusDonut = useMemo(() => {
    const complete = filteredProjectsForStatus.filter((p: any) => isCompletedProjectStatus(p.status)).length;
    const active = filteredProjectsForStatus.length - complete;
    return [
      { name: "Completed", value: complete },
      { name: "Not Complete", value: active },
    ].filter((x) => x.value > 0);
  }, [filteredProjectsForStatus]);

  const filteredProjectsForType = useMemo(() => byYears(projects as any[], typeYears), [projects, typeYears]);
  const typeQuality = useMemo(() => {
    const total = filteredProjectsForType.length;
    const missing = filteredProjectsForType.filter((p: any) => isMissingMeta(p.course_type)).length;
    const complete = total - missing;
    const percent = total ? Math.round((complete / total) * 100) : 100;
    return { total, missing, complete, percent, ...qualityTone(percent) };
  }, [filteredProjectsForType]);
  const avgByCourseType = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    filteredProjectsForType.forEach((p: any) => {
      if (isMissingMeta(p.course_type)) return;
      const type = normalizeCourseType(p.course_type);
      if (!map[type]) map[type] = { sum: 0, count: 0 };
      map[type].sum += Number(p.total_hours || 0);
      map[type].count += 1;
    });
    const ranked = Object.entries(map)
      .map(([name, v]) => ({ name, avgHours: Math.round((v.sum / Math.max(v.count, 1)) * 10) / 10 }));
    const order = ["New", "Revamp", "Maintenance"];
    return ranked.sort((a, b) => {
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.avgHours - a.avgHours;
    });
  }, [filteredProjectsForType]);

  const filteredProjectsForTool = useMemo(() => byYears(projects as any[], toolYears), [projects, toolYears]);
  const toolQuality = useMemo(() => {
    const total = filteredProjectsForTool.length;
    const missing = filteredProjectsForTool.filter((p: any) => !norm(String(p.authoring_tool || ""))).length;
    const complete = total - missing;
    const percent = total ? Math.round((complete / total) * 100) : 100;
    return { total, missing, complete, percent, ...qualityTone(percent) };
  }, [filteredProjectsForTool]);
  const avgByTool = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    filteredProjectsForTool.forEach((p: any) => {
      if (!norm(String(p.authoring_tool || ""))) return;
      const tool = normalizeTool(p.authoring_tool);
      if (!map[tool]) map[tool] = { sum: 0, count: 0 };
      map[tool].sum += Number(p.total_hours || 0);
      map[tool].count += 1;
    });
    const ranked = Object.entries(map)
      .map(([name, v]) => ({ name, avgHours: Math.round((v.sum / Math.max(v.count, 1)) * 10) / 10 }));
    const order = ["Storyline", "Rise", "LMS"];
    return ranked.sort((a, b) => {
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.avgHours - a.avgHours;
    });
  }, [filteredProjectsForTool]);

  const completedVsActiveByYear = useMemo(() => {
    const map: Record<string, { completed: number; active: number }> = {};
    byYears(projects as any[], stackedYears).forEach((p: any) => {
      const year = norm(String(p.reporting_year || "Unknown"));
      if (!map[year]) map[year] = { completed: 0, active: 0 };
      if (isCompletedProjectStatus(p.status)) map[year].completed += 1;
      else map[year].active += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, completed: v.completed, active: v.active }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, stackedYears]);

  const hasData = projects.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Program-level production and delivery signals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {gaugeCards.map((g) => (
          <Card key={g.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
                {g.label}
                <g.icon className="h-4 w-4" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold">{isLoading ? "—" : g.value}</p>
              <Progress value={g.percent} className="h-2" />
              <p className="text-xs text-muted-foreground">{g.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Upload Legacy, Modern, and Time Spent files to populate the dashboard.
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          <Card>
            <ChartHeader
              title="Courses Per Year"
              containerId="chart-courses-per-year"
              filename="courses-per-year"
              showData={isDataVisible("courses-per-year")}
              onToggleData={() => toggleDataVisible("courses-per-year")}
            />
            <CardContent className="space-y-3">
              <YearPills years={years} selectedYears={coursesPerYearYears} onChange={setCoursesPerYearYears} />
              <div id="chart-courses-per-year" className="space-y-3">
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coursesPerYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {isDataVisible("courses-per-year") && (
                  <ChartDataTable rows={coursesPerYear} columns={[{ key: "name", label: "Year" }, { key: "count", label: "Courses" }]} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <ChartHeader
              title="Average Hours Spent Developing by Year"
              containerId="chart-avg-hours-year"
              filename="avg-hours-year"
              showData={isDataVisible("avg-hours-year")}
              onToggleData={() => toggleDataVisible("avg-hours-year")}
            />
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={avgBreakdownMode === "style" ? "default" : "outline"} className="cursor-pointer" onClick={() => setAvgBreakdownMode("style")}>
                  Course Style
                </Badge>
                <Badge variant={avgBreakdownMode === "type" ? "default" : "outline"} className="cursor-pointer" onClick={() => setAvgBreakdownMode("type")}>
                  Course Type
                </Badge>
                <Badge variant={avgBreakdownMode === "tool" ? "default" : "outline"} className="cursor-pointer" onClick={() => setAvgBreakdownMode("tool")}>
                  Development Tool
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {avgDimensionOptions.map((key) => (
                  <Badge
                    key={key}
                    variant={effectiveAvgKeys.includes(key) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleAvgKey(key)}
                  >
                    {key}
                  </Badge>
                ))}
              </div>
              <div id="chart-avg-hours-year" className="space-y-3">
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={avgHoursByYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis yAxisId="left" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" fontSize={12} />
                      <Tooltip />
                      <Legend />
                      {avgSeries[0] && (
                        <Bar
                          yAxisId="right"
                          dataKey={avgSeries[0].countField}
                          name={`${avgSeries[0].label} Count`}
                          fill="hsl(var(--primary) / 0.18)"
                          radius={[3, 3, 0, 0]}
                        />
                      )}
                      {avgSeries.map((series) => (
                        <Line
                          key={series.avgField}
                          yAxisId="left"
                          type="monotone"
                          dataKey={series.avgField}
                          name={`${series.label} Avg Hours`}
                          stroke={series.color}
                          strokeWidth={2}
                          dot={{ fill: series.color, r: 3.5 }}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {isDataVisible("avg-hours-year") && <ChartDataTable rows={avgHoursByYear} />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <ChartHeader
              title="Completed vs Not Complete"
              containerId="chart-status-donut"
              filename="status-donut"
              showData={isDataVisible("status-donut")}
              onToggleData={() => toggleDataVisible("status-donut")}
            />
            <CardContent className="space-y-3">
              <YearPills years={years} selectedYears={statusYears} onChange={setStatusYears} />
              <div id="chart-status-donut" className="space-y-3">
                <div className="h-[440px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDonut}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={90}
                        outerRadius={155}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {statusDonut.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {isDataVisible("status-donut") && (
                  <ChartDataTable rows={statusDonut} columns={[{ key: "name", label: "Status" }, { key: "value", label: "Courses" }]} />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <ChartHeader
              title="Average Hours by Course Type"
              containerId="chart-avg-type"
              filename="avg-hours-course-type"
              showData={isDataVisible("avg-type")}
              onToggleData={() => toggleDataVisible("avg-type")}
            />
            <CardContent className="space-y-3">
              <YearPills years={years} selectedYears={typeYears} onChange={setTypeYears} />
              <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${typeQuality.border} ${typeQuality.bg} ${typeQuality.text}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${typeQuality.dot}`} />
                Data Accuracy {typeQuality.percent}% ({typeQuality.label}) · Missing Course Type: {typeQuality.missing}
              </div>
              <div id="chart-avg-type" className="space-y-3">
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={avgByCourseType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
                      <Bar dataKey="avgHours" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {isDataVisible("avg-type") && <ChartDataTable rows={avgByCourseType} columns={[{ key: "name", label: "Course Type" }, { key: "avgHours", label: "Avg Hours" }]} />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <ChartHeader
              title="Average Hours by Authoring Tool"
              containerId="chart-avg-tool"
              filename="avg-hours-tool"
              showData={isDataVisible("avg-tool")}
              onToggleData={() => toggleDataVisible("avg-tool")}
            />
            <CardContent className="space-y-3">
              <YearPills years={years} selectedYears={toolYears} onChange={setToolYears} />
              <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${toolQuality.border} ${toolQuality.bg} ${toolQuality.text}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${toolQuality.dot}`} />
                Data Accuracy {toolQuality.percent}% ({toolQuality.label}) · Missing Authoring Tool: {toolQuality.missing}
              </div>
              <div id="chart-avg-tool" className="space-y-3">
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={avgByTool}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
                      <Bar dataKey="avgHours" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {isDataVisible("avg-tool") && <ChartDataTable rows={avgByTool} columns={[{ key: "name", label: "Tool" }, { key: "avgHours", label: "Avg Hours" }]} />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <ChartHeader
              title="Yearly Course Volume: Completed vs Active"
              containerId="chart-stacked-status"
              filename="yearly-completed-active"
              showData={isDataVisible("stacked-status")}
              onToggleData={() => toggleDataVisible("stacked-status")}
            />
            <CardContent className="space-y-3">
              <YearPills years={years} selectedYears={stackedYears} onChange={setStackedYears} />
              <div id="chart-stacked-status" className="space-y-3">
                <div className="h-[440px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completedVsActiveByYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" name="Completed" stackId="a" fill="hsl(142 71% 45%)" />
                      <Bar dataKey="active" name="Not Complete" stackId="a" fill="hsl(35 92% 52%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {isDataVisible("stacked-status") && (
                  <ChartDataTable
                    rows={completedVsActiveByYear}
                    columns={[
                      { key: "name", label: "Year" },
                      { key: "completed", label: "Completed" },
                      { key: "active", label: "Not Complete" },
                    ]}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
