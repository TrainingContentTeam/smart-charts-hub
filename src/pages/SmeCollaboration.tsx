import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/hooks/use-time-data";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, Line } from "recharts";
import { YearPills } from "@/components/YearPills";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { CollaborationSurveyComingSoon } from "@/components/CollaborationSurveyComingSoon";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";

function text(v: unknown): string {
  return String(v || "").trim();
}

function toNumber(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export default function SmeCollaboration() {
  const { data: projects = [] } = useProjects();
  const [chartYears, setChartYears] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showChartData, setShowChartData] = useState<Record<string, boolean>>({});
  const isDataVisible = (key: string) => !!showChartData[key];
  const toggleDataVisible = (key: string) => setShowChartData((prev) => ({ ...prev, [key]: !prev[key] }));

  const years = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      if (p.reporting_year) set.add(text(p.reporting_year));
    });
    return [...set].sort();
  }, [projects]);

  const allIds = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      const id = text(p.id_assigned);
      if (id) set.add(id);
    });
    return [...set].sort();
  }, [projects]);

  const yearAllowed = (year: unknown) => {
    if (!chartYears.length) return true;
    return chartYears.includes(text(year));
  };

  const idAllowed = (id: unknown) => {
    if (!selectedIds.length) return true;
    return selectedIds.includes(text(id));
  };

  const coursesWithSme = useMemo(
    () => projects.filter((p: any) => text(p.sme).length > 0),
    [projects]
  );

  const filteredForSmeSummary = useMemo(
    () => coursesWithSme.filter((p: any) => yearAllowed(p.reporting_year)),
    [coursesWithSme, chartYears]
  );

  // Uses project total_hours as authored course hours (not time-entry hours)
  const smeAuthoredSummary = useMemo(() => {
    const map: Record<string, { courses: number; authoredHours: number }> = {};
    filteredForSmeSummary.forEach((p: any) => {
      const sme = text(p.sme);
      if (!map[sme]) map[sme] = { courses: 0, authoredHours: 0 };
      map[sme].courses += 1;
      map[sme].authoredHours += toNumber(p.total_hours);
    });
    return Object.entries(map)
      .map(([sme, data]) => ({
        sme,
        courses: data.courses,
        authoredHours: Math.round(data.authoredHours * 10) / 10,
      }))
      .sort((a, b) => b.authoredHours - a.authoredHours);
  }, [filteredForSmeSummary]);

  const idFocusedCourses = useMemo(
    () =>
      filteredForSmeSummary.filter((p: any) => {
        const id = text(p.id_assigned);
        return idAllowed(id);
      }),
    [filteredForSmeSummary, selectedIds]
  );

  const smeGraphicForSelectedIds = useMemo(() => {
    const map: Record<string, { courses: number; authoredHours: number }> = {};
    idFocusedCourses.forEach((p: any) => {
      const sme = text(p.sme);
      if (!map[sme]) map[sme] = { courses: 0, authoredHours: 0 };
      map[sme].courses += 1;
      map[sme].authoredHours += toNumber(p.total_hours);
    });
    return Object.entries(map)
      .map(([sme, data]) => ({
        sme,
        courses: data.courses,
        authoredHours: Math.round(data.authoredHours * 10) / 10,
      }))
      .sort((a, b) => b.authoredHours - a.authoredHours)
      .slice(0, 20);
  }, [idFocusedCourses]);

  const totalSmes = new Set(coursesWithSme.map((p: any) => text(p.sme))).size;
  const totalCourses = coursesWithSme.length;
  const totalHours = Math.round(coursesWithSme.reduce((sum: number, p: any) => sum + toNumber(p.total_hours), 0) * 10) / 10;

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SME Collaboration</h1>
        <p className="text-muted-foreground">SME assignment visibility by project, ID, and authored course hours.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">SME Authored Hours and Course Count</CardTitle>
            <ChartActions
              showData={isDataVisible("sme-authored")}
              onToggleData={() => toggleDataVisible("sme-authored")}
              onSnapshot={() => saveChartSnapshot("chart-sme-authored", "sme-authored-hours")}
            />
          </div>
          <YearPills years={years} selectedYears={chartYears} onChange={setChartYears} />
        </CardHeader>
        <CardContent>
          <div id="chart-sme-authored" className="space-y-3">
            <div className="h-[560px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={smeAuthoredSummary} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" xAxisId="left" />
                  <XAxis type="number" xAxisId="right" hide />
                  <YAxis type="category" dataKey="sme" width={230} interval={0} yAxisId="cat" />
                  <Tooltip />
                  <Legend />
                  <Bar xAxisId="left" yAxisId="cat" dataKey="authoredHours" name="Authored Hours" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  <Line xAxisId="right" yAxisId="cat" type="monotone" dataKey="courses" name="Courses" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("sme-authored") && <ChartDataTable rows={smeAuthoredSummary} columns={[{ key: "sme", label: "SME" }, { key: "authoredHours", label: "Authored Hours" }, { key: "courses", label: "Courses" }]} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">SME Focus by Assigned ID</CardTitle>
            <ChartActions
              showData={isDataVisible("assigned-id-focus")}
              onToggleData={() => toggleDataVisible("assigned-id-focus")}
              onSnapshot={() => saveChartSnapshot("chart-assigned-id-focus", "assigned-id-focus")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={selectedIds.length === 0 ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedIds([])}
            >
              All IDs
            </Badge>
            {allIds.map((id) => (
              <Badge
                key={id}
                variant={selectedIds.includes(id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleId(id)}
              >
                {id}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div id="chart-assigned-id-focus" className="space-y-3">
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={smeGraphicForSelectedIds} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="sme" width={230} interval={0} />
                  <Tooltip formatter={(v: any, n: any) => (n === "authoredHours" ? [`${v}h`, "Course Duration Hours"] : [v, n])} />
                  <Bar dataKey="authoredHours" name="Course Duration Hours" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {isDataVisible("assigned-id-focus") && (
              <ChartDataTable rows={smeGraphicForSelectedIds} columns={[{ key: "sme", label: "SME" }, { key: "authoredHours", label: "Course Duration Hours" }, { key: "courses", label: "Courses" }]} />
            )}
          </div>
        </CardContent>
      </Card>

      <CollaborationSurveyComingSoon />
    </div>
  );
}
