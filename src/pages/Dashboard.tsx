import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-time-data";
import { YearPills } from "@/components/YearPills";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { isCompletedProjectStatus, normalizeProjectStatus } from "@/lib/project-status";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";
import { Tooltip as HintTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { BookOpen, Brush, Camera, ChartColumnIncreasing, CheckCircle2, Clock3, Tag, Wrench } from "lucide-react";

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

function compareYearLabel(a: string, b: string): number {
  const aYear = /^\d{4}$/.test(a) ? Number(a) : Number.NaN;
  const bYear = /^\d{4}$/.test(b) ? Number(b) : Number.NaN;
  if (!Number.isNaN(aYear) && !Number.isNaN(bYear)) return aYear - bYear;
  if (!Number.isNaN(aYear)) return -1;
  if (!Number.isNaN(bYear)) return 1;
  return a.localeCompare(b);
}

function normalizeCourseName(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeVertical(value: unknown): string {
  const s = String(value || "").trim().toUpperCase();
  return s || "OTHER";
}

function verticalColor(vertical: string, index: number): string {
  const map: Record<string, string> = {
    FR1A: "hsl(0 78% 55%)",
    P1A: "hsl(215 88% 54%)",
    EMS1: "hsl(200 95% 60%)",
    D1A: "hsl(272 67% 55%)",
    LGU: "hsl(42 70% 55%)",
    OTHER: "hsl(190 18% 50%)",
  };
  if (map[vertical]) return map[vertical];
  return map.OTHER;
}

function statusColor(name: string): string {
  const n = String(name || "").trim().toLowerCase();
  if (n === "completed") return "hsl(142 71% 45%)";
  if (n === "not complete") return "hsl(35 92% 52%)";
  return "hsl(var(--chart-3))";
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

function MetricTitle({
  label,
  question,
  icon: Icon,
  snapshotTargetId,
  snapshotFilename,
}: {
  label: string;
  question: string;
  icon: React.ComponentType<{ className?: string }>;
  snapshotTargetId: string;
  snapshotFilename: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <HintTooltip>
        <TooltipTrigger asChild>
          <CardTitle
            title={question}
            className="text-sm text-muted-foreground flex cursor-help items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            <span className="min-w-0 break-words">{label}</span>
          </CardTitle>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-xs">{question}</TooltipContent>
      </HintTooltip>
      <HintTooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => saveChartSnapshot(snapshotTargetId, snapshotFilename)}
            aria-label={`Snapshot ${label}`}
          >
            <Camera className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">Snapshot</TooltipContent>
      </HintTooltip>
    </div>
  );
}

export default function Dashboard() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const [coursesPerYearYears, setCoursesPerYearYears] = useState<string[]>([]);
  const [avgBreakdownMode, setAvgBreakdownMode] = useState<"style" | "type" | "tool">("tool");
  const [avgActiveKeysByMode, setAvgActiveKeysByMode] = useState<Record<"style" | "type" | "tool", string[]>>({
    style: [],
    type: [],
    tool: [],
  });
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
    return [...set].sort(compareYearLabel);
  }, [projects]);

  const projectCountsByYear = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach((p: any) => {
      const year = norm(String(p.reporting_year || "Unknown"));
      map[year] = (map[year] || 0) + 1;
    });
    return Object.entries(map)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => compareYearLabel(a.year, b.year));
  }, [projects]);

  const timeByYear = useMemo(() => {
    const map: Record<string, { totalHours: number; projects: number }> = {};
    projects.forEach((p: any) => {
      const year = norm(String(p.reporting_year || "Unknown"));
      if (!map[year]) map[year] = { totalHours: 0, projects: 0 };
      map[year].totalHours += Number(p.total_hours || 0);
      map[year].projects += 1;
    });
    return Object.entries(map)
      .map(([year, v]) => ({
        year,
        totalHours: Math.round(v.totalHours * 10) / 10,
        avgHours: v.projects ? Math.round((v.totalHours / v.projects) * 10) / 10 : 0,
      }))
      .sort((a, b) => compareYearLabel(a.year, b.year));
  }, [projects]);

  const totalProjects = projects.length;
  const maxProjectsInYear = Math.max(1, ...projectCountsByYear.map((row) => row.count));
  const grandTotalHours = Math.round(projects.reduce((sum: number, p: any) => sum + Number(p.total_hours || 0), 0) * 10) / 10;
  const overallAvgTaskHours = totalProjects ? Math.round((grandTotalHours / totalProjects) * 10) / 10 : 0;
  const maxAvgHoursInYear = Math.max(1, ...timeByYear.map((row) => row.avgHours));

  const verticalPriority = ["FR1A", "P1A", "EMS1", "D1A", "LGU"];
  const coursesByYearByVertical = useMemo(() => {
    const byYear: Record<string, Record<string, number>> = {};
    const verticalSet = new Set<string>();

    projects.forEach((p: any) => {
      const year = norm(String(p.reporting_year || "Unknown"));
      const vertical = normalizeVertical(p.vertical);
      if (!byYear[year]) byYear[year] = {};
      byYear[year][vertical] = (byYear[year][vertical] || 0) + 1;
      verticalSet.add(vertical);
    });

    const orderedVerticals = [...verticalSet].sort((a, b) => {
      const ai = verticalPriority.indexOf(a);
      const bi = verticalPriority.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    const series = orderedVerticals.map((vertical, idx) => ({
      key: `v_${idx}`,
      label: vertical,
      color: verticalColor(vertical, idx),
    }));

    const rows = Object.entries(byYear)
      .map(([year, verticals]) => {
        const row: Record<string, string | number> = { year };
        series.forEach((s) => {
          row[s.key] = verticals[s.label] || 0;
        });
        return row;
      })
      .sort((a, b) => compareYearLabel(String(a.year), String(b.year)));

    return { rows, series };
  }, [projects]);
  const verticalLegend = useMemo(() => {
    const items: { key: string; label: string; color: string }[] = [];
    const seen = new Set<string>();
    coursesByYearByVertical.series.forEach((s) => {
      const label = verticalPriority.includes(s.label) ? s.label : "OTHER";
      const key = `${label}:${s.color}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ key, label, color: s.color });
    });
    return items;
  }, [coursesByYearByVertical.series]);

  const currentReportingYear = useMemo(() => {
    if (!years.length) return "";
    return [...years].sort(compareYearLabel)[years.length - 1];
  }, [years]);
  const currentYearProjects = useMemo(
    () => projects.filter((p: any) => norm(String(p.reporting_year || "")) === currentReportingYear),
    [projects, currentReportingYear]
  );
  const completedCourses = useMemo(
    () => currentYearProjects.filter((p: any) => isCompletedProjectStatus(p.status)).length,
    [currentYearProjects]
  );
  const notStartedCourses = useMemo(
    () =>
      currentYearProjects.filter((p: any) => normalizeProjectStatus(p.status, "").toLowerCase() === "not started").length,
    [currentYearProjects]
  );
  const completedPct = currentYearProjects.length ? Math.round((completedCourses / currentYearProjects.length) * 100) : 0;
  const notStartedPct = currentYearProjects.length ? Math.round((notStartedCourses / currentYearProjects.length) * 100) : 0;
  const statusByYear = useMemo(() => {
    const map: Record<string, { completed: number; incomplete: number; total: number }> = {};
    projects.forEach((p: any) => {
      const year = norm(String(p.reporting_year || "Unknown"));
      if (!map[year]) map[year] = { completed: 0, incomplete: 0, total: 0 };
      map[year].total += 1;
      if (isCompletedProjectStatus(p.status)) map[year].completed += 1;
      else map[year].incomplete += 1;
    });
    return Object.entries(map)
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => compareYearLabel(a.year, b.year));
  }, [projects]);
  const priorStatusByYear = useMemo(
    () => statusByYear.filter((row) => row.year !== currentReportingYear),
    [statusByYear, currentReportingYear]
  );
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
    const selectedForMode = avgActiveKeysByMode[avgBreakdownMode] || [];
    const filtered = selectedForMode.filter((k) => avgDimensionOptions.includes(k));
    if (filtered.length > 0) return filtered;
    return avgDimensionOptions.slice(0, 3);
  }, [avgActiveKeysByMode, avgBreakdownMode, avgDimensionOptions]);

  const avgSeries = useMemo(
    () =>
      effectiveAvgKeys.map((label, i) => ({
        label,
        avgField: `avg_${i}`,
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
      const totalHours = projects
        .filter((p: any) => norm(String(p.reporting_year || "")) === row.name)
        .reduce((sum: number, p: any) => sum + Number(p.total_hours || 0), 0);
      const n = projects.filter((p: any) => norm(String(p.reporting_year || "")) === row.name).length;
      row.avg_overall = n ? Math.round((totalHours / n) * 10) / 10 : null;
    });

    rows.forEach((row) => {
      effectiveAvgKeys.forEach((_, idx) => {
        const n = Number(row[`n_${idx}`] || 0);
        const sum = Number(row[`sum_${idx}`] || 0);
        row[`avg_${idx}`] = n ? Math.round((sum / n) * 10) / 10 : null;
      });
    });
    return rows;
  }, [projects, avgBreakdownMode, effectiveAvgKeys]);

  const toggleAvgKey = (key: string) => {
    setAvgActiveKeysByMode((prev) => {
      const current = prev[avgBreakdownMode] || [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [avgBreakdownMode]: next };
    });
  };
  const avgModeIndex = avgBreakdownMode === "style" ? 0 : avgBreakdownMode === "type" ? 1 : 2;

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

      <TooltipProvider delayDuration={120}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-gradient-to-b from-slate-50 to-card">
          <CardHeader className="pb-2">
            <MetricTitle
              label="Projects"
              question="How many courses did the LCT team work on each year?"
              icon={ChartColumnIncreasing}
              snapshotTargetId="metric-projects"
              snapshotFilename="metric-projects"
            />
          </CardHeader>
          <CardContent className="min-w-0 space-y-3">
            <div id="metric-projects" className="space-y-3">
              <p className="text-3xl font-bold">{isLoading ? "—" : totalProjects}</p>
              <p className="text-xs leading-tight text-muted-foreground break-words whitespace-normal">Total tasks by year</p>
              <div className="space-y-2">
                {projectCountsByYear.map((row) => (
                  <div key={row.year} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{row.year}</span>
                      <span className="font-medium">{row.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: `${Math.max(8, Math.round((row.count / maxProjectsInYear) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-gradient-to-b from-emerald-50 to-card">
          <CardHeader className="pb-2">
            <MetricTitle
              label="Avg Time"
              question="How much time does each task take on average, and how does that differ by year?"
              icon={Clock3}
              snapshotTargetId="metric-avg-time"
              snapshotFilename="metric-avg-time"
            />
          </CardHeader>
          <CardContent className="min-w-0 space-y-3">
            <div id="metric-avg-time" className="space-y-3">
              <p className="text-3xl font-bold">{isLoading ? "—" : `${overallAvgTaskHours}h`}</p>
              <p className="text-xs leading-tight text-muted-foreground break-words whitespace-normal">{grandTotalHours}h total</p>
              <div className="space-y-2">
                {timeByYear.map((row) => (
                  <div key={row.year} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{row.year}</span>
                      <span className="font-medium">{row.avgHours}h avg</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${Math.max(8, Math.round((row.avgHours / maxAvgHoursInYear) * 100))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{row.totalHours}h total</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-b from-blue-50 to-card">
          <CardHeader className="pb-2">
            <MetricTitle
              label="Verticals"
              question="How is course volume distributed across verticals by reporting year?"
              icon={BookOpen}
              snapshotTargetId="metric-verticals"
              snapshotFilename="metric-verticals"
            />
          </CardHeader>
          <CardContent className="min-w-0 space-y-3">
            <div id="metric-verticals" className="space-y-3">
              <p className="text-xs leading-tight text-muted-foreground break-words whitespace-normal">Courses by year and vertical</p>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={coursesByYearByVertical.rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis type="category" dataKey="year" width={44} fontSize={11} />
                    {coursesByYearByVertical.series.map((series) => (
                      <Bar
                        key={series.key}
                        dataKey={series.key}
                        stackId="v"
                        name={series.label}
                        fill={series.color}
                        activeBar={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {verticalLegend.map((s) => (
                  <div key={s.key} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-b from-amber-50 to-card">
          <CardHeader className="pb-2">
            <MetricTitle
              label="Status"
              question="For the current year, how many projects are Completed versus Not Started?"
              icon={CheckCircle2}
              snapshotTargetId="metric-status"
              snapshotFilename="metric-status"
            />
          </CardHeader>
          <CardContent className="min-w-0 space-y-3">
            <div id="metric-status" className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-200 bg-white/80 p-2">
                  <p className="text-[11px] leading-tight text-muted-foreground break-all">Completed</p>
                  <p className="text-2xl font-bold text-emerald-700">{completedCourses}</p>
                  <p className="text-[11px] text-muted-foreground">{completedPct}%</p>
                </div>
                <div className="rounded-md border border-amber-200 bg-white/80 p-2">
                  <p className="text-[11px] text-muted-foreground">Not Started</p>
                  <p className="text-2xl font-bold text-amber-700">{notStartedCourses}</p>
                  <p className="text-[11px] text-muted-foreground">{notStartedPct}%</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-amber-100">
                <div className="flex h-full w-full">
                  <div className="bg-emerald-500" style={{ width: `${completedPct}%` }} />
                  <div className="bg-amber-500" style={{ width: `${notStartedPct}%` }} />
                </div>
              </div>
              <p className="text-xs leading-tight text-muted-foreground break-words whitespace-normal">
                {currentReportingYear ? `${currentReportingYear} only` : "Current year only"}
              </p>
              <div className="border-t border-amber-200/80 pt-2" />
              <div className="space-y-2">
                {priorStatusByYear.map((row) => {
                  const completedYearPct = row.total ? Math.round((row.completed / row.total) * 100) : 0;
                  const incompleteYearPct = 100 - completedYearPct;
                  return (
                    <div key={row.year} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{row.year}</span>
                        <span className="font-medium">
                          {row.completed} / {row.incomplete}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                        <div className="flex h-full w-full">
                          <div className="bg-emerald-500" style={{ width: `${completedYearPct}%` }} />
                          <div className="bg-amber-500" style={{ width: `${incompleteYearPct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </TooltipProvider>

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
                      <RechartsTooltip />
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
              <p className="text-xs font-medium text-muted-foreground">Step 1: Choose Comparison Lens</p>
              <div className="relative inline-grid grid-cols-3 rounded-lg border bg-muted/40 p-1">
                <span
                  className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-background shadow-sm transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(${avgModeIndex * 100}%)` }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className={`relative z-10 h-9 rounded-md px-3 text-xs ${avgBreakdownMode === "style" ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                  onClick={() => setAvgBreakdownMode("style")}
                >
                  <Brush className="h-3.5 w-3.5" />
                  Style
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`relative z-10 h-9 rounded-md px-3 text-xs ${avgBreakdownMode === "type" ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                  onClick={() => setAvgBreakdownMode("type")}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Type
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={`relative z-10 h-9 rounded-md px-3 text-xs ${avgBreakdownMode === "tool" ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                  onClick={() => setAvgBreakdownMode("tool")}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Tool
                </Button>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Step 2: Select Values To Compare</p>
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
                      <RechartsTooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="avg_overall"
                        name="Overall Avg Hours"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                      />
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
                        {statusDonut.map((slice) => (
                          <Cell key={slice.name} fill={statusColor(slice.name)} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
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
                      <RechartsTooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
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
                      <RechartsTooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
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
                      <RechartsTooltip />
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
