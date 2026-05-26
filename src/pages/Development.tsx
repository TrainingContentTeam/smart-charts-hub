import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnimatedBarLabels } from "@/components/AnimatedBarLabels";
import { ChartPanel } from "@/components/ChartPanel";
import { CHART_FILTER_VARIANT, ChartFilterBar } from "@/components/ChartFilters";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { useTableSort } from "@/hooks/use-table-sort";
import { selectDevelopmentModel } from "@/lib/analytics/selectors";
import { getChartPayloadValue, navigateToProjectsFromChart } from "@/lib/projects-navigation";

function toOptions(values: string[]): CompactFilterOption[] {
  return values.map((value) => ({ label: value, value }));
}

function SummaryCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-bold">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function chartHeight(count: number, minimum = 300, maximum = 560) {
  return Math.max(minimum, Math.min(maximum, count * 38 + 120));
}

export default function Development() {
  const navigate = useNavigate();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();

  const currentYear = String(new Date().getFullYear());
  const [statusYears, setStatusYears] = useState<string[]>([]);
  const [statusOwners, setStatusOwners] = useState<string[]>([]);
  const [statusTools, setStatusTools] = useState<string[]>([]);
  const [statusTypes, setStatusTypes] = useState<string[]>([]);
  const [ownerYears, setOwnerYears] = useState<string[]>([]);
  const [ownerStatuses, setOwnerStatuses] = useState<string[]>([]);
  const [ownerTools, setOwnerTools] = useState<string[]>([]);
  const [ownerTypes, setOwnerTypes] = useState<string[]>([]);
  const [phaseYears, setPhaseYears] = useState<string[]>([]);
  const [phaseOwners, setPhaseOwners] = useState<string[]>([]);
  const [phaseTypes, setPhaseTypes] = useState<string[]>([]);
  const [phaseTools, setPhaseTools] = useState<string[]>([]);
  const [phaseRoles, setPhaseRoles] = useState<string[]>([]);
  const [toolYears, setToolYears] = useState<string[]>([]);
  const [toolOwners, setToolOwners] = useState<string[]>([]);
  const [toolStatuses, setToolStatuses] = useState<string[]>([]);
  const [toolTypes, setToolTypes] = useState<string[]>([]);
  const [typeYears, setTypeYears] = useState<string[]>([]);
  const [typeOwners, setTypeOwners] = useState<string[]>([]);
  const [typeStatuses, setTypeStatuses] = useState<string[]>([]);
  const [typeTools, setTypeTools] = useState<string[]>([]);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatuses, setActivityStatuses] = useState<string[]>([]);
  const [activityOwners, setActivityOwners] = useState<string[]>([]);
  const statusLabels = useAnimatedBarLabels({ labelKey: "status", orientation: "y", barColor: "hsl(var(--chart-1))", maxLength: 16 });
  const ownerLabels = useAnimatedBarLabels({ labelKey: "owner", orientation: "y", barColor: "hsl(var(--chart-2))", maxLength: 16 });
  const phaseLabels = useAnimatedBarLabels({ labelKey: "phase", orientation: "x", barColor: "hsl(var(--chart-3))" });
  const toolLabels = useAnimatedBarLabels({ labelKey: "tool", orientation: "x", barColor: "hsl(var(--chart-4))", contrastColor: "hsl(var(--foreground))" });
  const typeLabels = useAnimatedBarLabels({ labelKey: "type", orientation: "x", barColor: "hsl(var(--chart-5))" });

  const { sort, toggleSort } = useTableSort<"projectName" | "status" | "owner" | "latestTimeLogDate">({
    key: "latestTimeLogDate",
    direction: "desc",
  });
  const navigateToProjects = (params: Parameters<typeof navigateToProjectsFromChart>[1]) =>
    navigateToProjectsFromChart(navigate, params);

  const model = useMemo(
    () =>
      snapshot
        ? selectDevelopmentModel(snapshot, {
            currentYear,
            chartFilters: {
              activeProjectsByStatus: { reportingYears: statusYears, owners: statusOwners, authoringTools: statusTools, courseTypes: statusTypes },
              activeProjectsByIdOwner: { reportingYears: ownerYears, statuses: ownerStatuses, authoringTools: ownerTools, courseTypes: ownerTypes },
              developmentHoursByPhase: { reportingYears: phaseYears, owners: phaseOwners, courseTypes: phaseTypes, authoringTools: phaseTools, roleGroups: phaseRoles },
              activeProjectsByAuthoringTool: { reportingYears: toolYears, owners: toolOwners, statuses: toolStatuses, courseTypes: toolTypes },
              activeProjectsByCourseType: { reportingYears: typeYears, owners: typeOwners, statuses: typeStatuses, authoringTools: typeTools },
            },
            latestActivity: {
              search: activitySearch,
              statuses: activityStatuses,
              owners: activityOwners,
              sortKey: sort.key,
              sortDirection: sort.direction,
            },
          })
        : null,
    [
      activityOwners,
      activitySearch,
      activityStatuses,
      currentYear,
      ownerStatuses,
      ownerTypes,
      ownerTools,
      ownerYears,
      phaseOwners,
      phaseRoles,
      phaseTools,
      phaseTypes,
      phaseYears,
      snapshot,
      sort.direction,
      sort.key,
      statusOwners,
      statusTools,
      statusTypes,
      statusYears,
      toolOwners,
      toolStatuses,
      toolTypes,
      toolYears,
      typeOwners,
      typeStatuses,
      typeTools,
      typeYears,
    ],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading active project development model...</div>;
  }

  if (!model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No project data is available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Development</h1>
        <p className="text-muted-foreground">
          Active project status comes from project records. Effort breakdown comes from matched time logs only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Active Project Count"
          value={model.activeProjectCount}
          hint={`This year: ${model.activeProjectsCurrentYear} • Last year: ${model.activeProjectsPreviousYear}`}
        />
        <SummaryCard label={`${model.currentYear} Active Projects`} value={model.activeProjectsCurrentYear} />
        <SummaryCard label={`${model.previousYear} Active Projects`} value={model.activeProjectsPreviousYear} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Active Projects by Status"
          filters={
            <ChartFilterBar>
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={statusYears}
                onChange={setStatusYears}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={statusOwners}
                onChange={setStatusOwners}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Tool"
                options={toOptions(model.chartFilterOptions.authoringTools)}
                selected={statusTools}
                onChange={setStatusTools}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Type"
                options={toOptions(model.chartFilterOptions.courseTypes)}
                selected={statusTypes}
                onChange={setStatusTypes}
              />
            </ChartFilterBar>
          }
        >
          <div style={{ height: chartHeight(model.activeProjectsByStatus.length, 340) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByStatus} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="status" width={180} interval={0} tick={statusLabels.tick} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-1))"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    active: "yes",
                    status: getChartPayloadValue(payload, "status"),
                    year: statusYears,
                    owner: statusOwners,
                    tool: statusTools,
                    type: statusTypes,
                  })}
                  {...statusLabels.barHoverProps}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Active Projects by ID Owner"
          filters={
            <ChartFilterBar>
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={ownerYears}
                onChange={setOwnerYears}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Status"
                options={toOptions(model.chartFilterOptions.statuses)}
                selected={ownerStatuses}
                onChange={setOwnerStatuses}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Tool"
                options={toOptions(model.chartFilterOptions.authoringTools)}
                selected={ownerTools}
                onChange={setOwnerTools}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Type"
                options={toOptions(model.chartFilterOptions.courseTypes)}
                selected={ownerTypes}
                onChange={setOwnerTypes}
              />
            </ChartFilterBar>
          }
        >
          <div style={{ height: chartHeight(model.activeProjectsByIdOwner.length, 340) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByIdOwner} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="owner" width={180} interval={0} tick={ownerLabels.tick} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-2))"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    active: "yes",
                    owner: getChartPayloadValue(payload, "owner"),
                    year: ownerYears,
                    status: ownerStatuses,
                    tool: ownerTools,
                    type: ownerTypes,
                  })}
                  {...ownerLabels.barHoverProps}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <ChartPanel
          title="Development Hours by Phase"
          filters={
            <ChartFilterBar>
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={phaseYears}
                onChange={setPhaseYears}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={phaseOwners}
                onChange={setPhaseOwners}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Tool"
                options={toOptions(model.chartFilterOptions.authoringTools)}
                selected={phaseTools}
                onChange={setPhaseTools}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Type"
                options={toOptions(model.chartFilterOptions.courseTypes)}
                selected={phaseTypes}
                onChange={setPhaseTypes}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Role"
                options={toOptions(model.chartFilterOptions.roleGroups)}
                selected={phaseRoles}
                onChange={setPhaseRoles}
              />
            </ChartFilterBar>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.developmentHoursByPhase}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" minTickGap={18} tick={phaseLabels.tick} />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="hours"
                  fill="hsl(var(--chart-3))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    active: "yes",
                    timePhase: getChartPayloadValue(payload, "phase"),
                    year: phaseYears,
                    owner: phaseOwners,
                    tool: phaseTools,
                    type: phaseTypes,
                    timeRole: phaseRoles,
                  })}
                  {...phaseLabels.barHoverProps}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Active Projects by Authoring Tool"
          filters={
            <ChartFilterBar>
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={toolYears}
                onChange={setToolYears}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={toolOwners}
                onChange={setToolOwners}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Status"
                options={toOptions(model.chartFilterOptions.statuses)}
                selected={toolStatuses}
                onChange={setToolStatuses}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Type"
                options={toOptions(model.chartFilterOptions.courseTypes)}
                selected={toolTypes}
                onChange={setToolTypes}
              />
            </ChartFilterBar>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByAuthoringTool}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tool" minTickGap={18} tick={toolLabels.tick} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-4))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    active: "yes",
                    tool: getChartPayloadValue(payload, "tool"),
                    year: toolYears,
                    owner: toolOwners,
                    status: toolStatuses,
                    type: toolTypes,
                  })}
                  {...toolLabels.barHoverProps}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Active Projects by Course Type"
          filters={
            <ChartFilterBar>
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={typeYears}
                onChange={setTypeYears}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={typeOwners}
                onChange={setTypeOwners}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Status"
                options={toOptions(model.chartFilterOptions.statuses)}
                selected={typeStatuses}
                onChange={setTypeStatuses}
              />
              <CompactMultiSelectFilter
                variant={CHART_FILTER_VARIANT}
                label="Tool"
                options={toOptions(model.chartFilterOptions.authoringTools)}
                selected={typeTools}
                onChange={setTypeTools}
              />
            </ChartFilterBar>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByCourseType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" minTickGap={18} tick={typeLabels.tick} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--chart-5))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(payload: unknown) => navigateToProjects({
                    active: "yes",
                    type: getChartPayloadValue(payload, "type"),
                    year: typeYears,
                    owner: typeOwners,
                    status: typeStatuses,
                    tool: typeTools,
                  })}
                  {...typeLabels.barHoverProps}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Latest Activity by Project</CardTitle>
            <p className="text-sm text-muted-foreground">
              Filter the table lightly, then sort by project, status, owner, or most recent matched time log.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CompactMultiSelectFilter
              label="Status"
              options={toOptions(model.latestActivityFilterOptions.statuses)}
              selected={activityStatuses}
              onChange={setActivityStatuses}
            />
            <CompactMultiSelectFilter
              label="Owner"
              options={toOptions(model.latestActivityFilterOptions.owners)}
              selected={activityOwners}
              onChange={setActivityOwners}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            value={activitySearch}
            onChange={(event) => setActivitySearch(event.target.value)}
            placeholder="Search project, status, or owner"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableTableHeader
                    label="Project"
                    active={sort.key === "projectName"}
                    direction={sort.direction}
                    onToggle={() => toggleSort("projectName")}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    label="Status"
                    active={sort.key === "status"}
                    direction={sort.direction}
                    onToggle={() => toggleSort("status")}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    label="ID Owner"
                    active={sort.key === "owner"}
                    direction={sort.direction}
                    onToggle={() => toggleSort("owner")}
                  />
                </TableHead>
                <TableHead>
                  <SortableTableHeader
                    label="Latest Time Log"
                    active={sort.key === "latestTimeLogDate"}
                    direction={sort.direction}
                    onToggle={() => toggleSort("latestTimeLogDate")}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.latestActivityRows.slice(0, 30).map((row) => (
                <TableRow key={row.projectKey}>
                  <TableCell>
                    <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                      {row.projectName}
                    </ProjectLink>
                  </TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>
                    <PersonLink personName={row.owner}>{row.owner}</PersonLink>
                  </TableCell>
                  <TableCell>{row.latestTimeLogDate || "No matched logs"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
