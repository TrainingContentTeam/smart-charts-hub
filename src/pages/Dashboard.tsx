import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeEntries, useProjects } from "@/hooks/use-time-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Clock, FolderOpen, TrendingUp, Award, Layers } from "lucide-react";

const COLORS = [
  "hsl(230, 65%, 52%)",
  "hsl(262, 60%, 55%)",
  "hsl(173, 58%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(200, 60%, 50%)",
  "hsl(320, 60%, 50%)",
  "hsl(150, 50%, 45%)",
];

function buildGroupedBar(entries: any[], projects: any[], field: string) {
  const projectMap = new Map(projects.map((p: any) => [p.id, p]));
  const map: Record<string, number> = {};
  entries.forEach((e: any) => {
    const project = projectMap.get(e.project_id);
    const val = project?.[field] || "Unknown";
    if (val && val !== "Unknown") {
      map[val] = (map[val] || 0) + Number(e.hours);
    }
  });
  return Object.entries(map)
    .map(([name, hours]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, hours: Math.round(hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);
}

export default function Dashboard() {
  const { data: entries = [], isLoading: entriesLoading } = useTimeEntries();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const stats = useMemo(() => {
    const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
    const phases = new Set(entries.map((e) => e.phase));
    const projectHours: Record<string, number> = {};
    entries.forEach((e) => {
      const name = (e.projects as any)?.name || "Unknown";
      projectHours[name] = (projectHours[name] || 0) + Number(e.hours);
    });
    const topProject = Object.entries(projectHours).sort((a, b) => b[1] - a[1])[0];

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      projectCount: projects.length,
      avgHours: projects.length ? Math.round((totalHours / projects.length) * 100) / 100 : 0,
      topProject: topProject?.[0] || "N/A",
      phaseCount: phases.size,
    };
  }, [entries, projects]);

  const hoursByProject = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const name = (e.projects as any)?.name || "Unknown";
      map[name] = (map[name] || 0) + Number(e.hours);
    });
    return Object.entries(map)
      .map(([name, hours]) => ({ name: name.length > 25 ? name.slice(0, 25) + "…" : name, hours: Math.round(hours * 100) / 100 }))
      .sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const hoursByPhase = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      map[e.phase] = (map[e.phase] || 0) + Number(e.hours);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  const hoursByQuarter = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const q = e.quarter || "Unknown";
      map[q] = (map[q] || 0) + Number(e.hours);
    });
    return Object.entries(map)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  // New metadata charts
  const hoursByTool = useMemo(() => buildGroupedBar(entries, projects, "authoring_tool"), [entries, projects]);
  const hoursByType = useMemo(() => buildGroupedBar(entries, projects, "course_type"), [entries, projects]);
  const hoursByVertical = useMemo(() => buildGroupedBar(entries, projects, "vertical"), [entries, projects]);
  const hoursByYear = useMemo(() => buildGroupedBar(entries, projects, "reporting_year"), [entries, projects]);
  const hoursByPerson = useMemo(() => buildGroupedBar(entries, projects, "id_assigned"), [entries, projects]);

  const isLoading = entriesLoading || projectsLoading;
  const hasData = entries.length > 0;
  const hasMetadata = hoursByTool.length > 0 || hoursByType.length > 0;

  const kpis = [
    { label: "Total Hours", value: stats.totalHours, icon: Clock },
    { label: "Projects", value: stats.projectCount, icon: FolderOpen },
    { label: "Avg Hours/Project", value: stats.avgHours, icon: TrendingUp },
    { label: "Top Project", value: stats.topProject, icon: Award, isText: true },
    { label: "Phases Tracked", value: stats.phaseCount, icon: Layers },
  ];

  const MetaChart = ({ title, data }: { title: string; data: { name: string; hours: number }[] }) => {
    if (data.length === 0) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={60} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your project time data</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`font-bold ${kpi.isText ? "text-sm" : "text-2xl"}`}>
                {isLoading ? "—" : kpi.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No data yet</p>
            <p>Upload a Wrike export file to get started with your analytics.</p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hours by Project */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hours by Project</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursByProject} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Phase Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Time by Phase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={hoursByPhase} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                      {hoursByPhase.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Hours by Quarter */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Hours by Quarter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursByQuarter}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="hours" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Metadata charts */}
          {hasMetadata && (
            <>
              <MetaChart title="Hours by Authoring Tool" data={hoursByTool} />
              <MetaChart title="Hours by Course Type" data={hoursByType} />
              <MetaChart title="Hours by Vertical" data={hoursByVertical} />
              <MetaChart title="Hours by Reporting Year" data={hoursByYear} />
              <MetaChart title="Hours by Assigned Person" data={hoursByPerson} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
