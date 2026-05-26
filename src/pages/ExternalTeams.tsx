import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartPanel } from "@/components/ChartPanel";
import { CHART_FILTER_VARIANT, ChartFilterBar } from "@/components/ChartFilters";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { EXTERNAL_WORK_CLASSIFICATION_LABELS } from "@/lib/analytics/labels";
import { selectExternalTeamsModel, type ExternalTeamsFilters } from "@/lib/analytics/selectors";

function toOptions(values: string[]): CompactFilterOption[] {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));
}

type ExternalTeamProjectGroup = ReturnType<typeof selectExternalTeamsModel>["activeExternalTeamProjects"];

function ActiveExternalProjectsCard({
  title,
  projects,
}: {
  title: string;
  projects: ExternalTeamProjectGroup[keyof ExternalTeamProjectGroup];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length ? (
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.projectKey} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
                <ProjectLink projectName={project.projectName} reportingYear={project.reportingYear}>
                  {project.projectName}
                </ProjectLink>
                <p className="text-xs text-muted-foreground">
                  {project.status} / {project.reportingYear}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No active projects</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ExternalTeams() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const [roleChartFilters, setRoleChartFilters] = useState<ExternalTeamsFilters>({});
  const [phaseChartFilters, setPhaseChartFilters] = useState<ExternalTeamsFilters>({});
  const [workItemFilters, setWorkItemFilters] = useState<ExternalTeamsFilters>({});
  const [userFilters, setUserFilters] = useState<ExternalTeamsFilters>({});

  const model = useMemo(() => (snapshot ? selectExternalTeamsModel(snapshot) : null), [snapshot]);
  const roleChartModel = useMemo(
    () => (snapshot ? selectExternalTeamsModel(snapshot, roleChartFilters) : null),
    [roleChartFilters, snapshot],
  );
  const phaseChartModel = useMemo(
    () => (snapshot ? selectExternalTeamsModel(snapshot, phaseChartFilters) : null),
    [phaseChartFilters, snapshot],
  );
  const workItemModel = useMemo(
    () => (snapshot ? selectExternalTeamsModel(snapshot, workItemFilters) : null),
    [snapshot, workItemFilters],
  );
  const userModel = useMemo(
    () => (snapshot ? selectExternalTeamsModel(snapshot, userFilters) : null),
    [snapshot, userFilters],
  );

  const filterOptions = useMemo(() => {
    if (!snapshot) {
      return {
        roleGroups: [] as CompactFilterOption[],
        phases: [] as CompactFilterOption[],
        classifications: [] as CompactFilterOption[],
        reportingYears: [] as CompactFilterOption[],
        users: [] as CompactFilterOption[],
      };
    }

    return {
      roleGroups: toOptions(snapshot.timeLogs.map((row) => row.role_group)),
      phases: toOptions(snapshot.timeLogs.map((row) => row.category_phase)),
      classifications: Object.entries(EXTERNAL_WORK_CLASSIFICATION_LABELS).map(([value, label]) => ({ value, label })),
      reportingYears: toOptions(snapshot.canonicalProjects.map((project) => project.reporting_year || "Unknown")),
      users: toOptions(snapshot.timeLogs.map((row) => row.canonical_user_name || "Unknown")),
    };
  }, [snapshot]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading external team analytics...</div>;
  }

  if (!model || !roleChartModel || !phaseChartModel || !workItemModel || !userModel) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No external-team time log data is available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Other External Teams</h1>
        <p className="text-muted-foreground">
          External work is grouped from time logs and work-entity classification so legal, other external, standalone course work, and non-project work can be compared clearly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActiveExternalProjectsCard title="Legal" projects={model.activeExternalTeamProjects.legal} />
        <ActiveExternalProjectsCard title="CQO" projects={model.activeExternalTeamProjects.cqo} />
        <ActiveExternalProjectsCard title="Compliance (Policy)" projects={model.activeExternalTeamProjects.compliance} />
      </div>

      <ChartPanel
        title="Hours by External Role Group"
        filters={
          <ChartFilterBar>
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Phase" options={filterOptions.phases} selected={roleChartFilters.phases || []} onChange={(phases) => setRoleChartFilters((current) => ({ ...current, phases }))} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Class" options={filterOptions.classifications} selected={roleChartFilters.classifications || []} onChange={(classifications) => setRoleChartFilters((current) => ({ ...current, classifications: classifications as Array<keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS> }))} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Year" options={filterOptions.reportingYears} selected={roleChartFilters.reportingYears || []} onChange={(reportingYears) => setRoleChartFilters((current) => ({ ...current, reportingYears }))} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="User" options={filterOptions.users} selected={roleChartFilters.users || []} onChange={(users) => setRoleChartFilters((current) => ({ ...current, users }))} />
          </ChartFilterBar>
        }
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roleChartModel.hoursByExternalRoleGroup}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="roleGroup" interval={0} angle={-10} textAnchor="end" height={64} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel
        title="Hours by Reporting Phase"
        filters={
          <ChartFilterBar>
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Role" options={filterOptions.roleGroups} selected={phaseChartFilters.roleGroups || []} onChange={(roleGroups) => setPhaseChartFilters((current) => ({ ...current, roleGroups }))} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Class" options={filterOptions.classifications} selected={phaseChartFilters.classifications || []} onChange={(classifications) => setPhaseChartFilters((current) => ({ ...current, classifications: classifications as Array<keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS> }))} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Year" options={filterOptions.reportingYears} selected={phaseChartFilters.reportingYears || []} onChange={(reportingYears) => setPhaseChartFilters((current) => ({ ...current, reportingYears }))} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="User" options={filterOptions.users} selected={phaseChartFilters.users || []} onChange={(users) => setPhaseChartFilters((current) => ({ ...current, users }))} />
          </ChartFilterBar>
        }
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={phaseChartModel.hoursByCategoryPhase}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="phase" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Top Work Items"
          filters={
            <ChartFilterBar>
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Role" options={filterOptions.roleGroups} selected={workItemFilters.roleGroups || []} onChange={(roleGroups) => setWorkItemFilters((current) => ({ ...current, roleGroups }))} />
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Phase" options={filterOptions.phases} selected={workItemFilters.phases || []} onChange={(phases) => setWorkItemFilters((current) => ({ ...current, phases }))} />
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Class" options={filterOptions.classifications} selected={workItemFilters.classifications || []} onChange={(classifications) => setWorkItemFilters((current) => ({ ...current, classifications: classifications as Array<keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS> }))} />
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Year" options={filterOptions.reportingYears} selected={workItemFilters.reportingYears || []} onChange={(reportingYears) => setWorkItemFilters((current) => ({ ...current, reportingYears }))} />
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="User" options={filterOptions.users} selected={workItemFilters.users || []} onChange={(users) => setWorkItemFilters((current) => ({ ...current, users }))} />
            </ChartFilterBar>
          }
        >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Item</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workItemModel.topWorkItems.map((row) => (
                  <TableRow key={row.workItem}>
                    <TableCell>{row.workItem}</TableCell>
                    <TableCell>{row.hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </ChartPanel>

        <ChartPanel
          title="Users by Hours"
          filters={
            <ChartFilterBar>
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Role" options={filterOptions.roleGroups} selected={userFilters.roleGroups || []} onChange={(roleGroups) => setUserFilters((current) => ({ ...current, roleGroups }))} />
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Phase" options={filterOptions.phases} selected={userFilters.phases || []} onChange={(phases) => setUserFilters((current) => ({ ...current, phases }))} />
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Class" options={filterOptions.classifications} selected={userFilters.classifications || []} onChange={(classifications) => setUserFilters((current) => ({ ...current, classifications: classifications as Array<keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS> }))} />
              <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Year" options={filterOptions.reportingYears} selected={userFilters.reportingYears || []} onChange={(reportingYears) => setUserFilters((current) => ({ ...current, reportingYears }))} />
            </ChartFilterBar>
          }
        >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userModel.usersByHours.map((row) => (
                  <TableRow key={row.user}>
                    <TableCell>{row.user}</TableCell>
                    <TableCell>{row.hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </ChartPanel>
      </div>
    </div>
  );
}
