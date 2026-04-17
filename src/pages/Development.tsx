import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartPanel } from "@/components/ChartPanel";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { useTableSort } from "@/hooks/use-table-sort";
import { selectDevelopmentModel } from "@/lib/analytics/selectors";

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
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();

  const currentYear = String(new Date().getFullYear());
  const [statusOwners, setStatusOwners] = useState<string[]>([]);
  const [statusTools, setStatusTools] = useState<string[]>([]);
  const [ownerYears, setOwnerYears] = useState<string[]>([]);
  const [ownerTypes, setOwnerTypes] = useState<string[]>([]);
  const [phaseOwners, setPhaseOwners] = useState<string[]>([]);
  const [phaseTypes, setPhaseTypes] = useState<string[]>([]);
  const [phaseTools, setPhaseTools] = useState<string[]>([]);
  const [toolYears, setToolYears] = useState<string[]>([]);
  const [toolOwners, setToolOwners] = useState<string[]>([]);
  const [typeYears, setTypeYears] = useState<string[]>([]);
  const [typeOwners, setTypeOwners] = useState<string[]>([]);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatuses, setActivityStatuses] = useState<string[]>([]);
  const [activityOwners, setActivityOwners] = useState<string[]>([]);

  const { sort, toggleSort } = useTableSort({
    key: "latestTimeLogDate",
    direction: "desc",
  });

  const model = useMemo(
    () =>
      snapshot
        ? selectDevelopmentModel(snapshot, {
            currentYear,
            chartFilters: {
              activeProjectsByStatus: { owners: statusOwners, authoringTools: statusTools },
              activeProjectsByIdOwner: { reportingYears: ownerYears, courseTypes: ownerTypes },
              developmentHoursByPhase: { owners: phaseOwners, courseTypes: phaseTypes, authoringTools: phaseTools },
              activeProjectsByAuthoringTool: { reportingYears: toolYears, owners: toolOwners },
              activeProjectsByCourseType: { reportingYears: typeYears, owners: typeOwners },
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
      ownerTypes,
      ownerYears,
      phaseOwners,
      phaseTools,
      phaseTypes,
      snapshot,
      sort.direction,
      sort.key,
      statusOwners,
      statusTools,
      toolOwners,
      toolYears,
      typeOwners,
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
            <>
              <CompactMultiSelectFilter
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={statusOwners}
                onChange={setStatusOwners}
              />
              <CompactMultiSelectFilter
                label="Tool"
                options={toOptions(model.chartFilterOptions.authoringTools)}
                selected={statusTools}
                onChange={setStatusTools}
              />
            </>
          }
        >
          <div style={{ height: chartHeight(model.activeProjectsByStatus.length, 340) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByStatus} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="status" width={180} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Active Projects by ID Owner"
          filters={
            <>
              <CompactMultiSelectFilter
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={ownerYears}
                onChange={setOwnerYears}
              />
              <CompactMultiSelectFilter
                label="Course Type"
                options={toOptions(model.chartFilterOptions.courseTypes)}
                selected={ownerTypes}
                onChange={setOwnerTypes}
              />
            </>
          }
        >
          <div style={{ height: chartHeight(model.activeProjectsByIdOwner.length, 340) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByIdOwner} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="owner" width={180} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <ChartPanel
          title="Development Hours by Phase"
          filters={
            <>
              <CompactMultiSelectFilter
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={phaseOwners}
                onChange={setPhaseOwners}
              />
              <CompactMultiSelectFilter
                label="Course Type"
                options={toOptions(model.chartFilterOptions.courseTypes)}
                selected={phaseTypes}
                onChange={setPhaseTypes}
              />
              <CompactMultiSelectFilter
                label="Tool"
                options={toOptions(model.chartFilterOptions.authoringTools)}
                selected={phaseTools}
                onChange={setPhaseTools}
              />
            </>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.developmentHoursByPhase}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" minTickGap={18} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Active Projects by Authoring Tool"
          filters={
            <>
              <CompactMultiSelectFilter
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={toolYears}
                onChange={setToolYears}
              />
              <CompactMultiSelectFilter
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={toolOwners}
                onChange={setToolOwners}
              />
            </>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByAuthoringTool}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tool" minTickGap={18} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Active Projects by Course Type"
          filters={
            <>
              <CompactMultiSelectFilter
                label="Year"
                options={toOptions(model.chartFilterOptions.reportingYears)}
                selected={typeYears}
                onChange={setTypeYears}
              />
              <CompactMultiSelectFilter
                label="Owner"
                options={toOptions(model.chartFilterOptions.owners)}
                selected={typeOwners}
                onChange={setTypeOwners}
              />
            </>
          }
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByCourseType}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" minTickGap={18} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
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
