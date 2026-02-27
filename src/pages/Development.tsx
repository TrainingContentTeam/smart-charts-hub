import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProjects, useTimeEntries } from "@/hooks/use-time-data";
import { YearPills } from "@/components/YearPills";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { isCompletedProjectStatus } from "@/lib/project-status";
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
  LineChart,
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

function filterProjectsByYears(projects: any[], selectedYears: string[]) {
  if (!selectedYears.length) return projects;
  return projects.filter((p) => selectedYears.includes(clean(p.reporting_year)));
}

export default function Development() {
  const { data: projects = [] } = useProjects();
  const { data: entries = [] } = useTimeEntries();

  const [statusYears, setStatusYears] = useState<string[]>([]);
  const [trendYears, setTrendYears] = useState<string[]>([]);
  const [typeYears, setTypeYears] = useState<string[]>([]);
  const [categoryYears, setCategoryYears] = useState<string[]>([]);
  const [assignedYears, setAssignedYears] = useState<string[]>([]);
  const [topYears, setTopYears] = useState<string[]>([]);
  const [typeStatusFilter, setTypeStatusFilter] = useState<"all" | "completed" | "not_complete">("all");
  const [typeToolFilter, setTypeToolFilter] = useState<string[]>([]);
  const [typeMinCourses, setTypeMinCourses] = useState<1 | 2 | 3>(1);
  const [includeMissingType, setIncludeMissingType] = useState(false);
  const [showChartData, setShowChartData] = useState<Record<string, boolean>>({});

  const isDataVisible = (key: string) => !!showChartData[key];
  const toggleDataVisible = (key: string) => setShowChartData((prev) => ({ ...prev, [key]: !prev[key] }));

  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);

  const years = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      if (p.reporting_year) set.add(clean(p.reporting_year));
    });
    return [...set].sort();
  }, [projects]);

  const baseKpis = useMemo(() => {
    const totalHours = projects.reduce((sum: number, p: any) => sum + Number(p.total_hours || 0), 0);
    const courses = projects.length;
    return {
      courses,
      totalHours: Math.round(totalHours * 10) / 10,
      avgHours: courses ? Math.round((totalHours / courses) * 10) / 10 : 0,
    };
  }, [projects]);

  const statusMix = useMemo(() => {
    const rows = filterProjectsByYears(projects as any[], statusYears);
    const completed = rows.filter((p: any) => isCompletedProjectStatus(p.status)).length;
    const notComplete = rows.length - completed;
    return [
      { name: "Completed", count: completed },
      { name: "Not Complete", count: notComplete },
    ];
  }, [projects, statusYears]);

  const hoursTrend = useMemo(() => {
    const rows = filterProjectsByYears(projects as any[], trendYears);
    const map: Record<string, number> = {};
    rows.forEach((p: any) => {
      const year = clean(p.reporting_year || "Unknown");
      map[year] = (map[year] || 0) + Number(p.total_hours || 0);
    });
    return Object.entries(map)
      .map(([year, hours]) => ({ year, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [projects, trendYears]);

  const typeToolOptions = useMemo(() => {
    const rows = filterProjectsByYears(projects as any[], typeYears);
    const set = new Set<string>();
    rows.forEach((p: any) => set.add(normalizeTool(p.authoring_tool)));
    return [...set].sort();
  }, [projects, typeYears]);

  const avgByType = useMemo(() => {
    const rows = filterProjectsByYears(projects as any[], typeYears).filter((p: any) => {
      if (typeStatusFilter === "completed" && !isCompletedProjectStatus(p.status)) return false;
      if (typeStatusFilter === "not_complete" && isCompletedProjectStatus(p.status)) return false;
      if (typeToolFilter.length) {
        const tool = normalizeTool(p.authoring_tool);
        if (!typeToolFilter.includes(tool)) return false;
      }
      return true;
    });

    const map: Record<string, { sum: number; count: number }> = {};
    rows.forEach((p: any) => {
      if (!includeMissingType && isMissingMeta(p.course_type)) return;
      const type = normalizeCourseType(p.course_type);
      if (!map[type]) map[type] = { sum: 0, count: 0 };
      map[type].sum += Number(p.total_hours || 0);
      map[type].count += 1;
    });

    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        avgHours: Math.round((v.sum / Math.max(v.count, 1)) * 10) / 10,
        courses: v.count,
      }))
      .filter((row) => row.courses >= typeMinCourses)
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [projects, typeYears, typeStatusFilter, typeToolFilter, typeMinCourses, includeMissingType]);

  const categoryHours = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e: any) => {
      const project = projectMap.get(e.project_id);
      if (!project) return;
      if (categoryYears.length && !categoryYears.includes(clean(project.reporting_year))) return;
      const category = clean(e.category || e.phase || "Uncategorized");
      map[category] = (map[category] || 0) + Number(e.hours || 0);
    });
    return Object.entries(map)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 14);
  }, [entries, projectMap, categoryYears]);

  const topProjects = useMemo(() => {
    const rows = filterProjectsByYears(projects as any[], topYears);
    return [...rows]
      .sort((a: any, b: any) => Number(b.total_hours || 0) - Number(a.total_hours || 0))
      .slice(0, 12)
      .map((p: any) => ({ name: p.name, hours: Math.round(Number(p.total_hours || 0) * 10) / 10 }));
  }, [projects, topYears]);

  const assignedIdFocus = useMemo(() => {
    const rows = filterProjectsByYears(projects as any[], assignedYears);
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
  }, [projects, entries, assignedYears]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Development</h1>
        <p className="text-muted-foreground">Build-cycle effort, throughput, and workload distribution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Courses</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{baseKpis.courses}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Hours</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{baseKpis.totalHours}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Hours/Course</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{baseKpis.avgHours}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Completed vs Not Complete</CardTitle>
            <ChartActions
              showData={isDataVisible("dev-status")}
              onToggleData={() => toggleDataVisible("dev-status")}
              onSnapshot={() => saveChartSnapshot("chart-dev-status", "development-status-mix")}
            />
          </div>
          <YearPills years={years} selectedYears={statusYears} onChange={setStatusYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-dev-status" className="space-y-3">
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusMix}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("dev-status") && (
              <ChartDataTable rows={statusMix} columns={[{ key: "name", label: "Status" }, { key: "count", label: "Courses" }]} />
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
          <YearPills years={years} selectedYears={trendYears} onChange={setTrendYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-dev-trend" className="space-y-3">
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hoursTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} />
                  <Line type="monotone" dataKey="hours" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("dev-trend") && <ChartDataTable rows={hoursTrend} columns={[{ key: "year", label: "Year" }, { key: "hours", label: "Hours" }]} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Average Hours by Course Type</CardTitle>
            <ChartActions
              showData={isDataVisible("dev-type")}
              onToggleData={() => toggleDataVisible("dev-type")}
              onSnapshot={() => saveChartSnapshot("chart-dev-type", "development-avg-by-type")}
            />
          </div>
          <YearPills years={years} selectedYears={typeYears} onChange={setTypeYears} />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={typeStatusFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeStatusFilter("all")}>
                All Statuses
              </Badge>
              <Badge variant={typeStatusFilter === "completed" ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeStatusFilter("completed")}>
                Completed/Published
              </Badge>
              <Badge variant={typeStatusFilter === "not_complete" ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeStatusFilter("not_complete")}>
                Not Complete
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={typeMinCourses === 1 ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeMinCourses(1)}>
                Min 1 Course
              </Badge>
              <Badge variant={typeMinCourses === 2 ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeMinCourses(2)}>
                Min 2 Courses
              </Badge>
              <Badge variant={typeMinCourses === 3 ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeMinCourses(3)}>
                Min 3 Courses
              </Badge>
              <Badge variant={includeMissingType ? "default" : "outline"} className="cursor-pointer" onClick={() => setIncludeMissingType((v) => !v)}>
                Include Missing Type
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={typeToolFilter.length === 0 ? "default" : "outline"} className="cursor-pointer" onClick={() => setTypeToolFilter([])}>
                All Tools
              </Badge>
              {typeToolOptions.map((tool) => (
                <Badge
                  key={tool}
                  variant={typeToolFilter.includes(tool) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setTypeToolFilter((prev) =>
                      prev.includes(tool) ? prev.filter((x) => x !== tool) : [...prev, tool]
                    )
                  }
                >
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div id="chart-dev-type" className="space-y-3">
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: any, n: any, item: any) => (n === "courses" ? [v, "Courses"] : [`${v}h`, "Avg Hours"])} />
                  <Bar dataKey="avgHours" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("dev-type") && <ChartDataTable rows={avgByType} columns={[{ key: "name", label: "Type" }, { key: "avgHours", label: "Avg Hours" }, { key: "courses", label: "Courses" }]} />}
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
          <YearPills years={years} selectedYears={categoryYears} onChange={setCategoryYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-dev-category" className="space-y-3">
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
          <YearPills years={years} selectedYears={assignedYears} onChange={setAssignedYears} />
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
          <YearPills years={years} selectedYears={topYears} onChange={setTopYears} />
        </CardHeader>
        <CardContent className="space-y-2">
          {topProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects available for the selected years.</p>
          ) : (
            topProjects.map((project, idx) => (
              <div key={project.name} className="flex items-center justify-between border-b pb-2 text-sm">
                <span className="truncate pr-4">{idx + 1}. {project.name}</span>
                <span className="font-semibold">{project.hours}h</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
