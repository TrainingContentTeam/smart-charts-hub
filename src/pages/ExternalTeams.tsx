import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProjects, useTimeEntries } from "@/hooks/use-time-data";
import { YearPills } from "@/components/YearPills";
import { normalizeProjectStatus } from "@/lib/project-status";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Camera } from "lucide-react";

function clean(v: unknown): string {
  return String(v || "").trim();
}

type TeamKey = "legal" | "cqo";

type TeamConfig = {
  key: TeamKey;
  title: string;
  color: string;
  statusSet: Set<string>;
};

const TEAM_CONFIGS: TeamConfig[] = [
  {
    key: "legal",
    title: "Legal Team",
    color: "hsl(var(--chart-2))",
    statusSet: new Set(["staging legal review", "legal review", "process legal review"]),
  },
  {
    key: "cqo",
    title: "CQO Team",
    color: "hsl(var(--chart-4))",
    statusSet: new Set(["staging - cqo review", "cqo review"]),
  },
];

type TeamRow = {
  projectId: string;
  project: string;
  year: string;
  hours: number;
};

function isTeamMatch(value: string, team: TeamKey) {
  const s = value.toLowerCase();
  if (team === "legal") return s.includes("legal");
  return s.includes("cqo");
}

function buildTeamRows(entries: any[], projectMap: Map<string, any>, team: TeamKey): TeamRow[] {
  return entries
    .filter((e) => {
      const category = clean(e.category || e.phase);
      const user = clean(e.user_name);
      return isTeamMatch(category, team) || isTeamMatch(user, team);
    })
    .map((e) => {
      const project = projectMap.get(e.project_id);
      return {
        projectId: clean(e.project_id),
        project: clean(project?.name || "Unknown Project"),
        year: clean(project?.reporting_year || "Unknown"),
        hours: Math.round(Number(e.hours || 0) * 100) / 100,
      };
    });
}

function TeamSection({
  config,
  rows,
  years,
  projects,
}: {
  config: TeamConfig;
  rows: TeamRow[];
  years: string[];
  projects: any[];
}) {
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [showChartData, setShowChartData] = useState(false);

  const filteredRows = useMemo(
    () => (selectedYears.length ? rows.filter((r) => selectedYears.includes(r.year)) : rows),
    [rows, selectedYears]
  );

  const averageByYear = useMemo(() => {
    const byYear: Record<string, { total: number; projects: Set<string> }> = {};
    filteredRows.forEach((r) => {
      if (!byYear[r.year]) byYear[r.year] = { total: 0, projects: new Set<string>() };
      byYear[r.year].total += r.hours;
      byYear[r.year].projects.add(r.projectId);
    });
    return Object.entries(byYear)
      .map(([year, v]) => {
        const projectCount = Math.max(v.projects.size, 1);
        return {
          year,
          avgHours: Math.round((v.total / projectCount) * 10) / 10,
          totalHours: Math.round(v.total * 10) / 10,
          projects: v.projects.size,
        };
      })
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [filteredRows]);

  const overallAvg = useMemo(() => {
    const total = averageByYear.reduce((sum, r) => sum + r.totalHours, 0);
    const projectsTouched = new Set(filteredRows.map((r) => r.projectId)).size;
    return projectsTouched ? Math.round((total / projectsTouched) * 10) / 10 : 0;
  }, [averageByYear, filteredRows]);

  const maxAvg = Math.max(1, ...averageByYear.map((r) => r.avgHours));

  const teamProjectIds = useMemo(() => new Set(rows.map((r) => r.projectId)), [rows]);

  const statusRows = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach((p: any) => {
      const projectId = clean(p.id);
      if (!teamProjectIds.has(projectId)) return;
      const year = clean(p.reporting_year || "");
      if (selectedYears.length && !selectedYears.includes(year)) return;
      const status = normalizeProjectStatus(p.status, "Unknown");
      const key = status.toLowerCase();
      if (!config.statusSet.has(key)) return;
      map[status] = (map[status] || 0) + 1;
    });
    return Object.entries(map)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
  }, [projects, teamProjectIds, selectedYears, config.statusSet]);

  const statusTotal = statusRows.reduce((sum, r) => sum + r.count, 0);

  const statusProjects = useMemo(() => {
    const hoursByProject: Record<string, number> = {};
    filteredRows.forEach((r) => {
      hoursByProject[r.projectId] = (hoursByProject[r.projectId] || 0) + r.hours;
    });

    const rows = projects
      .filter((p: any) => {
        const projectId = clean(p.id);
        if (!teamProjectIds.has(projectId)) return false;
        const year = clean(p.reporting_year || "");
        if (selectedYears.length && !selectedYears.includes(year)) return false;
        const status = normalizeProjectStatus(p.status, "Unknown").toLowerCase();
        return config.statusSet.has(status);
      })
      .map((p: any) => {
        const projectId = clean(p.id);
        return {
          id: projectId,
          name: clean(p.name || "Unknown Project"),
          status: normalizeProjectStatus(p.status, "Unknown"),
          hours: Math.round((hoursByProject[projectId] || 0) * 10) / 10,
        };
      })
      .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));

    return rows;
  }, [projects, teamProjectIds, selectedYears, config.statusSet, filteredRows]);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-lg">{config.title}</CardTitle>
        <YearPills years={years} selectedYears={selectedYears} onChange={setSelectedYears} />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">Average Time</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => saveChartSnapshot(`metric-${config.key}-avg`, `${config.key}-avg-time-card`)}
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div id={`metric-${config.key}-avg`} className="space-y-3">
                <p className="text-3xl font-bold">{overallAvg}h</p>
                <p className="text-xs text-muted-foreground">Average team hours per project</p>
                <div className="space-y-2">
                  {averageByYear.map((row) => (
                    <div key={row.year} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{row.year}</span>
                        <span className="font-medium">{row.avgHours}h avg</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(8, Math.round((row.avgHours / maxAvg) * 100))}%`, backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => saveChartSnapshot(`metric-${config.key}-status`, `${config.key}-status-card`)}
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div id={`metric-${config.key}-status`} className="space-y-2">
                <p className="text-3xl font-bold">{statusTotal}</p>
                <p className="text-xs text-muted-foreground">Courses currently in {config.title} statuses</p>
                {statusRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No courses in these statuses for selected year(s).</p>
                ) : (
                  <>
                    {statusRows.map((r) => (
                      <div key={r.status} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{r.status}</span>
                        <span className="font-medium">{r.count}</span>
                      </div>
                    ))}
                    <div className="pt-2 space-y-2">
                      {statusProjects.map((project, idx) => (
                        <div key={project.id} className="rounded-md border text-sm">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left"
                            onClick={() =>
                              setExpandedProjectId((prev) => (prev === project.id ? null : project.id))
                            }
                          >
                            <span className="truncate pr-4">
                              {idx + 1}. {project.name}
                            </span>
                            <span className="font-semibold">{project.hours}h</span>
                          </button>
                          {expandedProjectId === project.id && (
                            <div className="grid grid-cols-1 gap-1 px-3 pb-3 pt-1 text-xs text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">Project:</span> {project.name}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Status:</span> {project.status}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Team Hours:</span> {project.hours}h
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Average Time Spent by Year</CardTitle>
              <ChartActions
                showData={showChartData}
                onToggleData={() => setShowChartData((v) => !v)}
                onSnapshot={() => saveChartSnapshot(`chart-${config.key}-avg-year`, `${config.key}-avg-time-by-year`)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div id={`chart-${config.key}-avg-year`} className="space-y-3">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={averageByYear}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => [`${v}h`, "Avg Hours"]} />
                    <Bar dataKey="avgHours" fill={config.color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {showChartData && (
                <ChartDataTable
                  rows={averageByYear}
                  columns={[
                    { key: "year", label: "Year" },
                    { key: "avgHours", label: "Avg Hours" },
                    { key: "totalHours", label: "Total Hours" },
                    { key: "projects", label: "Projects" },
                  ]}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

export default function ExternalTeams() {
  const { data: projects = [] } = useProjects();
  const { data: entries = [] } = useTimeEntries();

  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);

  const years = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      if (p.reporting_year) set.add(clean(p.reporting_year));
    });
    return [...set].sort();
  }, [projects]);

  const teamRows = useMemo(
    () => ({
      legal: buildTeamRows(entries, projectMap, "legal"),
      cqo: buildTeamRows(entries, projectMap, "cqo"),
    }),
    [entries, projectMap]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Other External Teams</h1>
        <p className="text-muted-foreground">Average time and status visibility for Legal and CQO.</p>
      </div>

      {TEAM_CONFIGS.map((config) => (
        <TeamSection key={config.key} config={config} rows={teamRows[config.key]} years={years} projects={projects} />
      ))}
    </div>
  );
}
