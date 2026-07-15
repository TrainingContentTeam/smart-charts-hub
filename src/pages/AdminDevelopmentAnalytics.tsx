import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnimatedBarLabels } from "@/components/AnimatedBarLabels";
import { ChartPanel } from "@/components/ChartPanel";
import { CHART_FILTER_VARIANT, ChartFilterBar } from "@/components/ChartFilters";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { selectAdminDevelopmentAnalyticsModel } from "@/lib/analytics/selectors";

const STACK_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

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

function chartHeight(count: number, minimum = 320, maximum = 680) {
  return Math.max(minimum, Math.min(maximum, count * 38 + 120));
}

function CategoryTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload?: { hours?: number; percentOfTotal?: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">Hours: {row.hours ?? 0}</p>
      <p className="text-muted-foreground">Share: {row.percentOfTotal ?? 0}%</p>
    </div>
  );
}

type ProjectHoursRow = Record<string, string | number | string[]> & {
  projectName: string;
  totalHours: number;
};

function fullChartHeight(count: number) {
  return Math.max(420, count * 38 + 120);
}

function ExpandChartButton({ chartTitle, onClick }: { chartTitle: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      aria-label={`Expand ${chartTitle}`}
      onClick={onClick}
    >
      <Maximize2 className="h-4 w-4" />
    </Button>
  );
}

function ProjectHoursChart({
  data,
  assignedIds,
  full = false,
}: {
  data: ProjectHoursRow[];
  assignedIds: string[];
  full?: boolean;
}) {
  const projectLabels = useAnimatedBarLabels({
    labelKey: "projectName",
    orientation: "y",
    barColor: "hsl(var(--chart-2))",
    maxLength: full ? 30 : 24,
  });

  return (
    <div style={{ height: full ? fullChartHeight(data.length) : chartHeight(data.length, 360, 560), minWidth: full ? 820 : undefined }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: full ? 80 : 40, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="projectName" width={full ? 300 : 240} interval={0} tick={projectLabels.tick} />
          <Tooltip />
          {assignedIds.map((assignedId, index) => (
            <Bar
              key={assignedId}
              dataKey={assignedId}
              stackId="hours"
              fill={STACK_COLORS[index % STACK_COLORS.length]}
              radius={[0, 4, 4, 0]}
              {...projectLabels.barHoverProps}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProjectHoursDialog({
  open,
  onOpenChange,
  data,
  assignedIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ProjectHoursRow[];
  assignedIds: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-[95vw] flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Full Total Hours by Individual ID and Project</DialogTitle>
          <DialogDescription>All projects are shown here. Use the page filters to narrow the full list.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto pr-2">
          <ProjectHoursChart data={data} assignedIds={assignedIds} full />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDevelopmentAnalytics() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const [reportingYears, setReportingYears] = useState<string[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [rawCategories, setRawCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [projectHoursOpen, setProjectHoursOpen] = useState(false);
  const categoryLabels = useAnimatedBarLabels({ labelKey: "category", orientation: "y", barColor: "hsl(var(--chart-1))", maxLength: 22 });
  const efficiencyLabels = useAnimatedBarLabels({ labelKey: "assignedId", orientation: "y", barColor: "hsl(var(--chart-3))", maxLength: 18 });

  const model = useMemo(
    () =>
      snapshot
        ? selectAdminDevelopmentAnalyticsModel(snapshot, {
            reportingYears,
            assignedIds,
            rawCategories,
            statuses,
          })
        : null,
    [assignedIds, rawCategories, reportingYears, snapshot, statuses],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading admin development analytics...</div>;
  }

  if (!model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No development analytics data is available yet.
        </CardContent>
      </Card>
    );
  }

  const efficiencyChartRows = model.efficiencyById.map((row) => ({
    ...row,
    efficiencyForChart: row.efficiency ?? 0,
  }));
  const topProjectHours = model.hoursByProject.slice(0, 10) as unknown as ProjectHoursRow[];
  const allProjectHours = model.hoursByProject as unknown as ProjectHoursRow[];

  const filters = (
    <ChartFilterBar>
      <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Year" options={toOptions(model.filterOptions.reportingYears)} selected={reportingYears} onChange={setReportingYears} />
      <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Assigned ID" options={toOptions(model.filterOptions.assignedIds)} selected={assignedIds} onChange={setAssignedIds} />
      <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Category" options={toOptions(model.filterOptions.rawCategories)} selected={rawCategories} onChange={setRawCategories} />
      <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Status" options={toOptions(model.filterOptions.statuses)} selected={statuses} onChange={setStatuses} />
    </ChartFilterBar>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Development Analytics</h1>
        <p className="text-muted-foreground">
          Administrator-only development metrics for evaluating effort, project coverage, and assigned-ID efficiency before promoting the views elsewhere.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Page Filters</CardTitle>
        </CardHeader>
        <CardContent>{filters}</CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="ID Development Hours" value={model.cards.totalDevelopmentHours} />
        <SummaryCard label="Development Categories" value={model.cards.categoryCount} />
        <SummaryCard label="Top Category" value={model.cards.topCategory} />
        <SummaryCard label="Assigned IDs" value={model.cards.assignedIdCount} />
      </div>

      <ChartPanel
        title="Development Time by Category"
        info="Uses raw time-log categories and only ID-role hours logged by the assigned ID on their assigned projects."
      >
        <div style={{ height: chartHeight(model.developmentTimeByCategory.length) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.developmentTimeByCategory} layout="vertical" margin={{ left: 40, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="category" width={220} interval={0} tick={categoryLabels.tick} />
              <Tooltip content={<CategoryTooltip />} />
              <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} {...categoryLabels.barHoverProps} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel
        title="Total Hours by Individual ID and Project"
        info="The page chart shows the top 10 projects by direct ID-role hours. Expand to inspect the full project list."
        actions={<ExpandChartButton chartTitle="Total Hours by Individual ID and Project" onClick={() => setProjectHoursOpen(true)} />}
      >
        <ProjectHoursChart data={topProjectHours} assignedIds={model.stackedAssignedIds} />
      </ChartPanel>
      <ProjectHoursDialog
        open={projectHoursOpen}
        onOpenChange={setProjectHoursOpen}
        data={allProjectHours}
        assignedIds={model.stackedAssignedIds}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
        <ChartPanel
          title="Efficiency by Individual ID"
          info="Primary ranking is completed course length hours divided by direct ID development hours."
        >
          <div style={{ height: chartHeight(efficiencyChartRows.length, 340) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiencyChartRows} layout="vertical" margin={{ left: 24, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="assignedId" width={180} interval={0} tick={efficiencyLabels.tick} />
                <Tooltip />
                <Bar dataKey="efficiencyForChart" name="Efficiency" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} {...efficiencyLabels.barHoverProps} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Efficiency Ranking">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Assigned ID</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Dev Hours</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead className="text-right">Courses</TableHead>
                <TableHead className="text-right">Length</TableHead>
                <TableHead className="text-right">Efficiency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.efficiencyById.map((row) => (
                <TableRow key={row.assignedId}>
                  <TableCell>{row.rank}</TableCell>
                  <TableCell>
                    <PersonLink personName={row.assignedId}>{row.assignedId}</PersonLink>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.tier}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.totalDevelopmentHours}</TableCell>
                  <TableCell className="text-right">{row.progressWeightedCompleted}</TableCell>
                  <TableCell className="text-right">{row.completedCourseCount}</TableCell>
                  <TableCell className="text-right">{row.completedCourseLengthHours}</TableCell>
                  <TableCell className="text-right">{row.efficiency ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ChartPanel>
      </div>

      <ChartPanel title="Project and ID Hour Matrix">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned ID</TableHead>
              <TableHead className="text-right">ID Hours</TableHead>
              <TableHead className="text-right">Course Length</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.idProjectHours.map((row) => (
              <TableRow key={`${row.projectKey}-${row.assignedId}`}>
                <TableCell>
                  <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                    {row.projectName}
                  </ProjectLink>
                </TableCell>
                <TableCell>{row.reportingYear}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  <PersonLink personName={row.assignedId}>{row.assignedId}</PersonLink>
                </TableCell>
                <TableCell className="text-right">{row.hours}</TableCell>
                <TableCell className="text-right">{row.courseLengthHours}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartPanel>
    </div>
  );
}
