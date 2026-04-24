import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartPanel } from "@/components/ChartPanel";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { EXTERNAL_WORK_CLASSIFICATION_LABELS } from "@/lib/analytics/labels";
import { selectExternalTeamsModel } from "@/lib/analytics/selectors";

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
  const [roleGroups, setRoleGroups] = useState<string[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<Array<keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS>>([]);
  const [reportingYears, setReportingYears] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);

  const model = useMemo(
    () =>
      snapshot
        ? selectExternalTeamsModel(snapshot, {
            roleGroups,
            phases,
            classifications,
            reportingYears,
            users,
          })
        : null,
    [classifications, phases, reportingYears, roleGroups, snapshot, users],
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

  if (!model) {
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <CompactMultiSelectFilter label="Role Group" options={filterOptions.roleGroups} selected={roleGroups} onChange={setRoleGroups} />
          <CompactMultiSelectFilter label="Phase" options={filterOptions.phases} selected={phases} onChange={setPhases} />
          <CompactMultiSelectFilter label="Work Classification" options={filterOptions.classifications} selected={classifications} onChange={(values) => setClassifications(values as Array<keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS>)} />
          <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.reportingYears} selected={reportingYears} onChange={setReportingYears} />
          <CompactMultiSelectFilter label="User" options={filterOptions.users} selected={users} onChange={setUsers} />
        </CardContent>
      </Card>

      <ChartPanel title="Hours by External Role Group">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.hoursByExternalRoleGroup}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="roleGroup" interval={0} angle={-10} textAnchor="end" height={64} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel title="Hours by Reporting Phase">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.hoursByCategoryPhase}>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Work Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Item</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.topWorkItems.map((row) => (
                  <TableRow key={row.workItem}>
                    <TableCell>{row.workItem}</TableCell>
                    <TableCell>{row.hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.usersByHours.map((row) => (
                  <TableRow key={row.user}>
                    <TableCell>{row.user}</TableCell>
                    <TableCell>{row.hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
