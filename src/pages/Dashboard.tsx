import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartPanel } from "@/components/ChartPanel";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { PHASE_EXPLANATION_TOOLTIP, WORK_SCOPE_LABELS } from "@/lib/analytics/labels";
import { selectDashboardModel } from "@/lib/analytics/selectors";

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function toOptions(values: string[]): CompactFilterOption[] {
  return uniqueSorted(values).map((value) => ({ label: value, value }));
}

type ProjectFilterParams = Record<string, string | string[] | undefined>;

function getPayloadValue(payload: unknown, key: string) {
  const value = (payload as Record<string, unknown> | null)?.[key];
  return value === undefined || value === null ? "" : String(value);
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-3xl font-bold">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const model = useMemo(() => (snapshot ? selectDashboardModel(snapshot) : null), [snapshot]);

  const [projectsByYearFilters, setProjectsByYearFilters] = useState<{ statuses: string[]; courseTypes: string[]; authoringTools: string[] }>({
    statuses: [],
    courseTypes: [],
    authoringTools: [],
  });
  const [activeStatusFilters, setActiveStatusFilters] = useState<{ reportingYears: string[]; owners: string[]; authoringTools: string[] }>({
    reportingYears: [],
    owners: [],
    authoringTools: [],
  });
  const [courseTypeFilters, setCourseTypeFilters] = useState<{ reportingYears: string[]; statuses: string[] }>({
    reportingYears: [],
    statuses: [],
  });
  const [authoringToolFilters, setAuthoringToolFilters] = useState<{ reportingYears: string[]; statuses: string[] }>({
    reportingYears: [],
    statuses: [],
  });
  const [phaseFilters, setPhaseFilters] = useState<{ reportingYears: string[]; roleGroups: string[]; workScopes: Array<"matched_project_work" | "standalone_work" | "non_project_work"> }>({
    reportingYears: [],
    roleGroups: [],
    workScopes: [],
  });
  const [roleFilters, setRoleFilters] = useState<{ reportingYears: string[]; phases: string[]; workScopes: Array<"matched_project_work" | "standalone_work" | "non_project_work"> }>({
    reportingYears: [],
    phases: [],
    workScopes: [],
  });

  const projectsByYearModel = useMemo(
    () => (snapshot ? selectDashboardModel(snapshot, { projectsByReportingYear: projectsByYearFilters }) : null),
    [projectsByYearFilters, snapshot],
  );
  const activeStatusModel = useMemo(
    () => (snapshot ? selectDashboardModel(snapshot, { activeProjectsByStatus: activeStatusFilters }) : null),
    [activeStatusFilters, snapshot],
  );
  const courseTypeModel = useMemo(
    () => (snapshot ? selectDashboardModel(snapshot, { projectMixByCourseType: courseTypeFilters }) : null),
    [courseTypeFilters, snapshot],
  );
  const authoringToolModel = useMemo(
    () => (snapshot ? selectDashboardModel(snapshot, { projectMixByAuthoringTool: authoringToolFilters }) : null),
    [authoringToolFilters, snapshot],
  );
  const phaseModel = useMemo(
    () => (snapshot ? selectDashboardModel(snapshot, { hoursByTimeLogPhase: phaseFilters }) : null),
    [phaseFilters, snapshot],
  );
  const roleModel = useMemo(
    () => (snapshot ? selectDashboardModel(snapshot, { hoursByRoleGroup: roleFilters }) : null),
    [roleFilters, snapshot],
  );

  const navigateToProjects = (params: ProjectFilterParams) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      values.filter(Boolean).forEach((entry) => searchParams.append(key, entry));
    });
    const search = searchParams.toString();
    navigate(search ? `/projects?${search}` : "/projects");
  };

  const filterOptions = useMemo(() => {
    if (!snapshot) {
      return {
        years: [] as CompactFilterOption[],
        statuses: [] as CompactFilterOption[],
        courseTypes: [] as CompactFilterOption[],
        authoringTools: [] as CompactFilterOption[],
        owners: [] as CompactFilterOption[],
        roleGroups: [] as CompactFilterOption[],
        phases: [] as CompactFilterOption[],
        workScopes: [] as CompactFilterOption[],
      };
    }

    return {
      years: toOptions(snapshot.canonicalProjects.map((project) => project.reporting_year || "Unknown")),
      statuses: toOptions(snapshot.canonicalProjects.map((project) => project.status)),
      courseTypes: toOptions(snapshot.canonicalProjects.map((project) => project.course_type || "Unknown")),
      authoringTools: toOptions(snapshot.canonicalProjects.map((project) => project.authoring_tool || "Unknown")),
      owners: toOptions(snapshot.canonicalProjects.map((project) => project.primary_id_assigned || "Unassigned")),
      roleGroups: toOptions(snapshot.timeLogs.map((row) => row.role_group)),
      phases: toOptions(snapshot.timeLogs.map((row) => row.category_phase)),
      workScopes: [
        { label: WORK_SCOPE_LABELS.matched_project_work, value: "matched_project_work" },
        { label: WORK_SCOPE_LABELS.standalone_work, value: "standalone_work" },
        { label: WORK_SCOPE_LABELS.non_project_work, value: "non_project_work" },
      ],
    };
  }, [snapshot]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading analytics snapshot...</div>;
  }

  if (!model || !projectsByYearModel || !activeStatusModel || !courseTypeModel || !authoringToolModel || !phaseModel || !roleModel) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Upload Legacy, Modern, Time Log, and SME files to build the analytics snapshot.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Project counts come from project records only. Logged effort is shown separately so lifecycle status and workflow activity stay honest.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Projects" value={model.cards.totalProjects} />
        <MetricCard label="Active Projects" value={model.cards.activeProjects} />
        <MetricCard label="Completed / Published" value={model.cards.completedPublishedProjects} />
        <MetricCard
          label="Discrepancy Flags"
          value={model.cards.discrepancyCount}
          hint={`${model.cards.discrepancyRate}% of project records`}
        />
      </div>

      <div className="space-y-4">
        <ChartPanel
          title="Projects by Reporting Year"
          filters={
            <>
              <CompactMultiSelectFilter label="Status" options={filterOptions.statuses} selected={projectsByYearFilters.statuses} onChange={(statuses) => setProjectsByYearFilters((current) => ({ ...current, statuses }))} />
              <CompactMultiSelectFilter label="Course Type" options={filterOptions.courseTypes} selected={projectsByYearFilters.courseTypes} onChange={(courseTypes) => setProjectsByYearFilters((current) => ({ ...current, courseTypes }))} />
              <CompactMultiSelectFilter label="Authoring Tool" options={filterOptions.authoringTools} selected={projectsByYearFilters.authoringTools} onChange={(authoringTools) => setProjectsByYearFilters((current) => ({ ...current, authoringTools }))} />
            </>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectsByYearModel.projectsByReportingYear}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-1))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    year: getPayloadValue(payload, "year"),
                    status: projectsByYearFilters.statuses,
                    type: projectsByYearFilters.courseTypes,
                    tool: projectsByYearFilters.authoringTools,
                  })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Active Projects by Status"
          filters={
            <>
              <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.years} selected={activeStatusFilters.reportingYears} onChange={(reportingYears) => setActiveStatusFilters((current) => ({ ...current, reportingYears }))} />
              <CompactMultiSelectFilter label="Owner" options={filterOptions.owners} selected={activeStatusFilters.owners} onChange={(owners) => setActiveStatusFilters((current) => ({ ...current, owners }))} />
              <CompactMultiSelectFilter label="Authoring Tool" options={filterOptions.authoringTools} selected={activeStatusFilters.authoringTools} onChange={(authoringTools) => setActiveStatusFilters((current) => ({ ...current, authoringTools }))} />
            </>
          }
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeStatusModel.activeProjectsByStatus} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="status" width={220} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-2))"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    active: "yes",
                    status: getPayloadValue(payload, "status"),
                    year: activeStatusFilters.reportingYears,
                    owner: activeStatusFilters.owners,
                    tool: activeStatusFilters.authoringTools,
                  })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel
            title="Project Mix by Course Type"
            filters={
              <>
                <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.years} selected={courseTypeFilters.reportingYears} onChange={(reportingYears) => setCourseTypeFilters((current) => ({ ...current, reportingYears }))} />
                <CompactMultiSelectFilter label="Status" options={filterOptions.statuses} selected={courseTypeFilters.statuses} onChange={(statuses) => setCourseTypeFilters((current) => ({ ...current, statuses }))} />
              </>
            }
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={courseTypeModel.projectMixByCourseType}
                    dataKey="value"
                    nameKey="label"
                    outerRadius={120}
                    label
                    cursor="pointer"
                    onClick={(payload: unknown) => navigateToProjects({
                      type: getPayloadValue(payload, "label"),
                      year: courseTypeFilters.reportingYears,
                      status: courseTypeFilters.statuses,
                    })}
                  >
                    {courseTypeModel.projectMixByCourseType.map((entry, index) => (
                      <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} style={{ cursor: "pointer" }} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="Active Project Status Mix">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={model.activeProjectStatusMix}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={68}
                    outerRadius={120}
                    label
                    cursor="pointer"
                    onClick={(payload: unknown) => navigateToProjects({
                      active: "yes",
                      status: getPayloadValue(payload, "label"),
                    })}
                  >
                    {model.activeProjectStatusMix.map((entry, index) => (
                      <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} style={{ cursor: "pointer" }} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>

        <ChartPanel
          title="Project Mix by Authoring Tool"
          filters={
            <>
              <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.years} selected={authoringToolFilters.reportingYears} onChange={(reportingYears) => setAuthoringToolFilters((current) => ({ ...current, reportingYears }))} />
              <CompactMultiSelectFilter label="Status" options={filterOptions.statuses} selected={authoringToolFilters.statuses} onChange={(statuses) => setAuthoringToolFilters((current) => ({ ...current, statuses }))} />
            </>
          }
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={authoringToolModel.projectMixByAuthoringTool} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={180} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--chart-3))"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    tool: getPayloadValue(payload, "label"),
                    year: authoringToolFilters.reportingYears,
                    status: authoringToolFilters.statuses,
                  })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Hours by Time-Log Phase"
          info={PHASE_EXPLANATION_TOOLTIP}
          filters={
            <>
              <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.years} selected={phaseFilters.reportingYears} onChange={(reportingYears) => setPhaseFilters((current) => ({ ...current, reportingYears }))} />
              <CompactMultiSelectFilter label="Role Group" options={filterOptions.roleGroups} selected={phaseFilters.roleGroups} onChange={(roleGroups) => setPhaseFilters((current) => ({ ...current, roleGroups }))} />
              <CompactMultiSelectFilter label="Work Scope" options={filterOptions.workScopes} selected={phaseFilters.workScopes} onChange={(workScopes) => setPhaseFilters((current) => ({ ...current, workScopes: workScopes as Array<"matched_project_work" | "standalone_work" | "non_project_work"> }))} />
            </>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={phaseModel.hoursByTimeLogPhase}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="hours"
                  fill="hsl(var(--chart-4))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    timePhase: getPayloadValue(payload, "phase"),
                    year: phaseFilters.reportingYears,
                    timeRole: phaseFilters.roleGroups,
                  })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Hours by Role Group"
          filters={
            <>
              <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.years} selected={roleFilters.reportingYears} onChange={(reportingYears) => setRoleFilters((current) => ({ ...current, reportingYears }))} />
              <CompactMultiSelectFilter label="Phase" options={filterOptions.phases} selected={roleFilters.phases} onChange={(phases) => setRoleFilters((current) => ({ ...current, phases }))} />
              <CompactMultiSelectFilter label="Work Scope" options={filterOptions.workScopes} selected={roleFilters.workScopes} onChange={(workScopes) => setRoleFilters((current) => ({ ...current, workScopes: workScopes as Array<"matched_project_work" | "standalone_work" | "non_project_work"> }))} />
            </>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleModel.hoursByRoleGroup}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="roleGroup" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="hours"
                  fill="hsl(var(--chart-5))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    timeRole: getPayloadValue(payload, "roleGroup"),
                    year: roleFilters.reportingYears,
                    timePhase: roleFilters.phases,
                  })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}
