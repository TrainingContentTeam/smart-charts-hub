import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProjects, useTimeEntries } from "@/hooks/use-time-data";
import { YearPills } from "@/components/YearPills";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
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
} from "recharts";
import { Camera } from "lucide-react";

function clean(v: unknown): string {
  return String(v || "").trim();
}

function isCompletedStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "complete";
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
  const [topYears, setTopYears] = useState<string[]>([]);

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
    const completed = rows.filter((p: any) => isCompletedStatus(p.status)).length;
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

  const avgByType = useMemo(() => {
    const rows = filterProjectsByYears(projects as any[], typeYears);
    const map: Record<string, { sum: number; count: number }> = {};
    rows.forEach((p: any) => {
      const type = clean(p.course_type || "Unknown");
      if (!map[type]) map[type] = { sum: 0, count: 0 };
      map[type].sum += Number(p.total_hours || 0);
      map[type].count += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, avgHours: Math.round((v.sum / Math.max(v.count, 1)) * 10) / 10 }))
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [projects, typeYears]);

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
            <Button variant="outline" size="sm" onClick={() => saveChartSnapshot("chart-dev-status", "development-status-mix")}> 
              <Camera className="h-3.5 w-3.5 mr-1" /> Snapshot
            </Button>
          </div>
          <YearPills years={years} selectedYears={statusYears} onChange={setStatusYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-dev-status" className="h-[380px]">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Total Development Hours by Year</CardTitle>
            <Button variant="outline" size="sm" onClick={() => saveChartSnapshot("chart-dev-trend", "development-hours-trend")}> 
              <Camera className="h-3.5 w-3.5 mr-1" /> Snapshot
            </Button>
          </div>
          <YearPills years={years} selectedYears={trendYears} onChange={setTrendYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-dev-trend" className="h-[420px]">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Average Hours by Course Type</CardTitle>
            <Button variant="outline" size="sm" onClick={() => saveChartSnapshot("chart-dev-type", "development-avg-by-type")}> 
              <Camera className="h-3.5 w-3.5 mr-1" /> Snapshot
            </Button>
          </div>
          <YearPills years={years} selectedYears={typeYears} onChange={setTypeYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-dev-type" className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avgByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
                <Bar dataKey="avgHours" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Hours by Development Category</CardTitle>
            <Button variant="outline" size="sm" onClick={() => saveChartSnapshot("chart-dev-category", "development-hours-by-category")}> 
              <Camera className="h-3.5 w-3.5 mr-1" /> Snapshot
            </Button>
          </div>
          <YearPills years={years} selectedYears={categoryYears} onChange={setCategoryYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-dev-category" className="h-[460px]">
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
