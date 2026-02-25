import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTimeEntries, useProjects } from "@/hooks/use-time-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Clock, FolderOpen, TrendingUp, Award, Layers, CalendarDays, Users, Search } from "lucide-react";

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

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map(o => (
          <Badge
            key={o}
            variant={selected.includes(o) ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o])}
          >
            {o}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: entries = [], isLoading: entriesLoading } = useTimeEntries();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const [searchText, setSearchText] = useState("");
  const [selYears, setSelYears] = useState<string[]>([]);
  const [selStatus, setSelStatus] = useState<string[]>([]);
  const [selType, setSelType] = useState<string[]>([]);
  const [selTool, setSelTool] = useState<string[]>([]);
  const [selVertical, setSelVertical] = useState<string[]>([]);
  const [selCategory, setSelCategory] = useState<string[]>([]);

  const isLoading = entriesLoading || projectsLoading;

  // Filter options
  const filterOptions = useMemo(() => {
    const years = new Set<string>();
    const statuses = new Set<string>();
    const types = new Set<string>();
    const tools = new Set<string>();
    const verticals = new Set<string>();
    const categories = new Set<string>();
    projects.forEach((p: any) => {
      if (p.reporting_year) years.add(p.reporting_year);
      if (p.status) statuses.add(p.status);
      if (p.course_type) types.add(p.course_type);
      if (p.authoring_tool) tools.add(p.authoring_tool);
      if (p.vertical) verticals.add(p.vertical);
    });
    entries.forEach((e: any) => {
      if (e.category) categories.add(e.category);
    });
    return {
      years: [...years].sort(),
      statuses: [...statuses].sort(),
      types: [...types].sort(),
      tools: [...tools].sort(),
      verticals: [...verticals].sort(),
      categories: [...categories].sort(),
    };
  }, [projects, entries]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    const q = searchText.toLowerCase();
    return projects.filter((p: any) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (selYears.length && !selYears.includes(p.reporting_year)) return false;
      if (selStatus.length && !selStatus.includes(p.status)) return false;
      if (selType.length && !selType.includes(p.course_type)) return false;
      if (selTool.length && !selTool.includes(p.authoring_tool)) return false;
      if (selVertical.length && !selVertical.includes(p.vertical)) return false;
      return true;
    });
  }, [projects, searchText, selYears, selStatus, selType, selTool, selVertical]);

  const filteredProjectIds = useMemo(() => new Set(filteredProjects.map((p: any) => p.id)), [filteredProjects]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e: any) => {
      if (!filteredProjectIds.has(e.project_id)) return false;
      if (selCategory.length && !selCategory.includes(e.category)) return false;
      return true;
    });
  }, [entries, filteredProjectIds, selCategory]);

  // KPI stats
  const stats = useMemo(() => {
    const totalHours = filteredProjects.reduce((s: number, p: any) => s + Number(p.total_hours || 0), 0);
    const completed = filteredProjects.filter((p: any) => p.status === "Completed").length;
    const inProgress = filteredProjects.filter((p: any) => p.status === "In Progress").length;
    const categories = new Set(filteredEntries.map((e: any) => e.category).filter(Boolean));
    const users = new Set(filteredEntries.map((e: any) => e.user_name).filter(Boolean));
    const years = new Set(filteredProjects.map((p: any) => p.reporting_year).filter(Boolean));

    return {
      totalCourses: filteredProjects.length,
      completed,
      inProgress,
      totalHours: Math.round(totalHours * 100) / 100,
      avgHoursPerCourse: filteredProjects.length ? Math.round((totalHours / filteredProjects.length) * 10) / 10 : 0,
      categoryCount: categories.size,
      userCount: users.size,
      yearCount: years.size,
    };
  }, [filteredProjects, filteredEntries]);

  // Courses per year
  const coursesPerYear = useMemo(() => {
    const map: Record<string, number> = {};
    filteredProjects.forEach((p: any) => {
      const year = p.reporting_year || "";
      if (year) map[year] = (map[year] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProjects]);

  // Avg hours per course by year
  const avgHoursByYear = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    filteredProjects.forEach((p: any) => {
      const year = p.reporting_year || "";
      if (!year) return;
      if (!map[year]) map[year] = { sum: 0, count: 0 };
      map[year].sum += Number(p.total_hours || 0);
      map[year].count += 1;
    });
    return Object.entries(map)
      .map(([name, { sum, count }]) => ({ name, avgHours: Math.round((sum / count) * 10) / 10 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProjects]);

  // Total hours by category
  const hoursByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEntries.forEach((e: any) => {
      const cat = e.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + Number(e.hours);
    });
    return Object.entries(map)
      .map(([name, hours]) => ({ name: name.length > 25 ? name.slice(0, 25) + "…" : name, fullName: name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredEntries]);

  // Completion status pie
  const statusPie = useMemo(() => {
    return [
      { name: "Completed", value: stats.completed },
      { name: "In Progress", value: stats.inProgress },
    ].filter(d => d.value > 0);
  }, [stats]);

  // Avg hours by course type
  const hoursByCourseType = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredProjects.forEach((p: any) => {
      const type = p.course_type || "";
      if (!type) return;
      if (!map[type]) map[type] = { total: 0, count: 0 };
      map[type].total += Number(p.total_hours || 0);
      map[type].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({ name, avgHours: Math.round((total / count) * 10) / 10 }))
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [filteredProjects]);

  // Avg hours by authoring tool
  const hoursByTool = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredProjects.forEach((p: any) => {
      const tool = p.authoring_tool || "";
      if (!tool) return;
      if (!map[tool]) map[tool] = { total: 0, count: 0 };
      map[tool].total += Number(p.total_hours || 0);
      map[tool].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({ name, avgHours: Math.round((total / count) * 10) / 10 }))
      .sort((a, b) => b.avgHours - a.avgHours);
  }, [filteredProjects]);

  // Legacy vs Modern trend
  const legacyModernTrend = useMemo(() => {
    const map: Record<string, { legacy: number; modern: number; inProgress: number }> = {};
    filteredProjects.forEach((p: any) => {
      const year = p.reporting_year || "Unknown";
      if (!map[year]) map[year] = { legacy: 0, modern: 0, inProgress: 0 };
      if (p.data_source === "legacy") map[year].legacy += 1;
      else if (p.data_source === "modern") map[year].modern += 1;
      else map[year].inProgress += 1;
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProjects]);

  // Category summary table
  const categorySummary = useMemo(() => {
    const map: Record<string, { hours: number; courses: Set<string>; users: Set<string> }> = {};
    filteredEntries.forEach((e: any) => {
      const cat = e.category || "Uncategorized";
      if (!map[cat]) map[cat] = { hours: 0, courses: new Set(), users: new Set() };
      map[cat].hours += Number(e.hours);
      if (e.project_id) map[cat].courses.add(e.project_id);
      if (e.user_name) map[cat].users.add(e.user_name);
    });
    return Object.entries(map)
      .map(([name, { hours, courses, users }]) => ({
        name,
        totalHours: Math.round(hours * 10) / 10,
        courseCount: courses.size,
        avgHours: courses.size ? Math.round((hours / courses.size) * 10) / 10 : 0,
        userCount: users.size,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredEntries]);

  const hasData = projects.length > 0;

  const kpis = [
    { label: "Total Courses", value: `${stats.totalCourses}`, sub: `${stats.completed}✓ ${stats.inProgress}⏳`, icon: FolderOpen },
    { label: "Total Hours", value: stats.totalHours.toLocaleString(), icon: Clock },
    { label: "Avg Hours/Course", value: stats.avgHoursPerCourse, icon: TrendingUp },
    { label: "Categories", value: stats.categoryCount, icon: Layers },
    { label: "Users Tracked", value: stats.userCount, icon: Users },
    { label: "Years Covered", value: stats.yearCount, icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Course production analytics overview</p>
      </div>

      {/* Filter Bar */}
      {hasData && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search courses…" value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-4">
              <MultiSelect label="Year" options={filterOptions.years} selected={selYears} onChange={setSelYears} />
              <MultiSelect label="Status" options={filterOptions.statuses} selected={selStatus} onChange={setSelStatus} />
              <MultiSelect label="Type" options={filterOptions.types} selected={selType} onChange={setSelType} />
              <MultiSelect label="Tool" options={filterOptions.tools} selected={selTool} onChange={setSelTool} />
              <MultiSelect label="Vertical" options={filterOptions.verticals} selected={selVertical} onChange={setSelVertical} />
              <MultiSelect label="Category" options={filterOptions.categories} selected={selCategory} onChange={setSelCategory} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : kpi.value}</div>
              {"sub" in kpi && kpi.sub && <p className="text-xs text-muted-foreground">{kpi.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No data yet</p>
            <p>Upload your CSV files to see analytics.</p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Row 1: Courses per Year + Avg Hours by Year */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Courses per Year</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coursesPerYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="count" name="Courses" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Avg Hours per Course by Year</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={avgHoursByYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
                      <Line type="monotone" dataKey="avgHours" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Hours by Category + Completion Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Total Hours by Category</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hoursByCategory.slice(0, 15)} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Total Hours"]} />
                      <Bar dataKey="hours" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Completion Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                        {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 3: Course Type + Authoring Tool */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hoursByCourseType.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Avg Hours by Course Type</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hoursByCourseType}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
                        <Bar dataKey="avgHours" name="Avg Hours" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
            {hoursByTool.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Avg Hours by Authoring Tool</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hoursByTool}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={11} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
                        <Bar dataKey="avgHours" name="Avg Hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Row 4: Legacy vs Modern Trend */}
          {legacyModernTrend.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Legacy vs Modern Trend</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={legacyModernTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="legacy" name="Legacy" fill="hsl(var(--chart-1))" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="modern" name="Modern" fill="hsl(var(--chart-3))" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="inProgress" name="In Progress" fill="hsl(var(--chart-4))" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Summary Table */}
          {categorySummary.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Category Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Courses</TableHead>
                        <TableHead className="text-right">Avg Hours</TableHead>
                        <TableHead className="text-right">Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categorySummary.map(c => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right">{c.totalHours}</TableCell>
                          <TableCell className="text-right">{c.courseCount}</TableCell>
                          <TableCell className="text-right font-semibold">{c.avgHours}h</TableCell>
                          <TableCell className="text-right">{c.userCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
