import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useTimeEntries, useProjects } from "@/hooks/use-time-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Clock, FolderOpen, TrendingUp, Award, Layers, CalendarDays } from "lucide-react";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(200, 60%, 50%)",
  "hsl(320, 60%, 50%)",
  "hsl(150, 50%, 45%)",
];

export default function Dashboard() {
  const { data: entries = [], isLoading: entriesLoading } = useTimeEntries();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const isLoading = entriesLoading || projectsLoading;

  // Build lookup maps
  const projectMap = useMemo(
    () => new Map(projects.map((p: any) => [p.id, p])),
    [projects]
  );

  // --- KPI stats ---
  const stats = useMemo(() => {
    const totalHours = entries.reduce((s, e) => s + Number(e.hours), 0);
    const projectsWithTime = new Set(entries.map((e) => e.project_id).filter(Boolean));
    const phases = new Set(entries.map((e) => e.phase));
    const years = new Set(projects.map((p: any) => p.reporting_year).filter(Boolean));

    // Top phase by total hours
    const phaseHours: Record<string, number> = {};
    entries.forEach((e) => {
      phaseHours[e.phase] = (phaseHours[e.phase] || 0) + Number(e.hours);
    });
    const topPhase = Object.entries(phaseHours).sort((a, b) => b[1] - a[1])[0];

    return {
      totalHours: Math.round(totalHours * 100) / 100,
      totalCourses: projects.length,
      coursesWithTime: projectsWithTime.size,
      avgHoursPerCourse: projectsWithTime.size
        ? Math.round((totalHours / projectsWithTime.size) * 10) / 10
        : 0,
      phaseCount: phases.size,
      yearCount: years.size,
      topPhase: topPhase?.[0] || "N/A",
    };
  }, [entries, projects]);

  // --- Courses per year ---
  const coursesPerYear = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach((p: any) => {
      const year = (p.reporting_year || "").replace(/\s*\(\d+\)$/, "").trim();
      if (year) map[year] = (map[year] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  // --- Average hours per phase (across all courses that have that phase) ---
  const avgHoursPerPhase = useMemo(() => {
    const phaseTotal: Record<string, number> = {};
    const phaseProjects: Record<string, Set<string>> = {};
    entries.forEach((e) => {
      phaseTotal[e.phase] = (phaseTotal[e.phase] || 0) + Number(e.hours);
      if (!phaseProjects[e.phase]) phaseProjects[e.phase] = new Set();
      if (e.project_id) phaseProjects[e.phase].add(e.project_id);
    });
    return Object.entries(phaseTotal)
      .map(([phase, total]) => ({
        name: phase.length > 25 ? phase.slice(0, 25) + "…" : phase,
        fullName: phase,
        avgHours: Math.round((total / (phaseProjects[phase]?.size || 1)) * 10) / 10,
        totalHours: Math.round(total * 10) / 10,
        courseCount: phaseProjects[phase]?.size || 0,
      }))
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [entries]);

  // --- Average total hours per course by year ---
  const avgHoursByYear = useMemo(() => {
    // Sum hours per project
    const projectHoursMap: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.project_id) {
        projectHoursMap[e.project_id] = (projectHoursMap[e.project_id] || 0) + Number(e.hours);
      }
    });
    // Group by year
    const yearTotals: Record<string, { sum: number; count: number }> = {};
    Object.entries(projectHoursMap).forEach(([projectId, hours]) => {
      const project = projectMap.get(projectId);
      const year = (project?.reporting_year || "").replace(/\s*\(\d+\)$/, "").trim();
      if (!year) return;
      if (!yearTotals[year]) yearTotals[year] = { sum: 0, count: 0 };
      yearTotals[year].sum += hours;
      yearTotals[year].count += 1;
    });
    return Object.entries(yearTotals)
      .map(([name, { sum, count }]) => ({
        name,
        avgHours: Math.round((sum / count) * 10) / 10,
        courses: count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, projectMap]);

  // --- Phase distribution pie ---
  const phasePie = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      map[e.phase] = (map[e.phase] || 0) + Number(e.hours);
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name: name.length > 20 ? name.slice(0, 20) + "…" : name,
        value: Math.round(value * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  // --- Hours by course type ---
  const hoursByCourseType = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    const projectHoursMap: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.project_id)
        projectHoursMap[e.project_id] = (projectHoursMap[e.project_id] || 0) + Number(e.hours);
    });
    Object.entries(projectHoursMap).forEach(([projectId, hours]) => {
      const project = projectMap.get(projectId);
      const type = project?.course_type || "";
      if (!type) return;
      if (!map[type]) map[type] = { total: 0, count: 0 };
      map[type].total += hours;
      map[type].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({
        name,
        avgHours: Math.round((total / count) * 10) / 10,
        courses: count,
      }))
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [entries, projectMap]);

  // --- Hours by authoring tool ---
  const hoursByTool = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    const projectHoursMap: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.project_id)
        projectHoursMap[e.project_id] = (projectHoursMap[e.project_id] || 0) + Number(e.hours);
    });
    Object.entries(projectHoursMap).forEach(([projectId, hours]) => {
      const project = projectMap.get(projectId);
      const tool = project?.authoring_tool || "";
      if (!tool) return;
      if (!map[tool]) map[tool] = { total: 0, count: 0 };
      map[tool].total += hours;
      map[tool].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({
        name,
        avgHours: Math.round((total / count) * 10) / 10,
        courses: count,
      }))
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [entries, projectMap]);

  const hasData = entries.length > 0;

  const kpis = [
    { label: "Total Courses", value: stats.totalCourses, icon: FolderOpen },
    { label: "Total Hours", value: stats.totalHours.toLocaleString(), icon: Clock },
    { label: "Avg Hours/Course", value: stats.avgHoursPerCourse, icon: TrendingUp },
    { label: "Phases Tracked", value: stats.phaseCount, icon: Layers },
    { label: "Top Phase", value: stats.topPhase, icon: Award, isText: true },
    { label: "Years Covered", value: stats.yearCount, icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Course production analytics overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`font-bold ${kpi.isText ? "text-sm truncate" : "text-2xl"}`}>
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
            <p>Upload your Course Data and Time Entries files to see analytics.</p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Row 1: Courses per Year + Avg Hours per Course by Year */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Courses per Year</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coursesPerYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={50} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" name="Courses" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg Hours per Course by Year</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={avgHoursByYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={50} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        formatter={(value: any, name: string) =>
                          name === "avgHours" ? [`${value}h`, "Avg Hours"] : [value, name]
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="avgHours"
                        name="Avg Hours"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--accent))", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Average Hours per Phase + Phase Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg Hours per Phase (per course)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={avgHoursPerPhase.slice(0, 15)} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                      <Tooltip
                        formatter={(value: any) => [`${value}h`, "Avg per course"]}
                      />
                      <Bar dataKey="avgHours" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Hours by Phase</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={phasePie.slice(0, 8)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        fontSize={10}
                      >
                        {phasePie.slice(0, 8).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Avg Hours by Course Type + Authoring Tool */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hoursByCourseType.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Avg Hours by Course Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hoursByCourseType}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={50} />
                        <YAxis fontSize={12} />
                        <Tooltip
                          formatter={(value: any, name: string) =>
                            name === "avgHours"
                              ? [`${value}h`, "Avg Hours"]
                              : [value, name]
                          }
                        />
                        <Bar dataKey="avgHours" name="Avg Hours" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {hoursByTool.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Avg Hours by Authoring Tool</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hoursByTool}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={50} />
                        <YAxis fontSize={12} />
                        <Tooltip
                          formatter={(value: any, name: string) =>
                            name === "avgHours"
                              ? [`${value}h`, "Avg Hours"]
                              : [value, name]
                          }
                        />
                        <Bar dataKey="avgHours" name="Avg Hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Phase Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Phase Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phase</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead className="text-right">Courses</TableHead>
                      <TableHead className="text-right">Avg Hours/Course</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {avgHoursPerPhase.map((p) => (
                      <TableRow key={p.fullName}>
                        <TableCell className="font-medium">{p.fullName}</TableCell>
                        <TableCell className="text-right">{p.totalHours}</TableCell>
                        <TableCell className="text-right">{p.courseCount}</TableCell>
                        <TableCell className="text-right font-semibold">{p.avgHours}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
