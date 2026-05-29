import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAnimatedBarLabels } from "@/components/AnimatedBarLabels";
import { ChartPanel } from "@/components/ChartPanel";
import { CHART_FILTER_VARIANT, ChartDateRangeFilter, ChartFilterBar } from "@/components/ChartFilters";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { resolveProjectFromRoute } from "@/lib/analytics/project-routing";
import { selectProjectDetailModel } from "@/lib/analytics/selectors";
import { getChartPayloadValue, navigateToProjectsFromChart } from "@/lib/projects-navigation";
import NotFound from "./NotFound";

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

function toOptions(values: string[]): CompactFilterOption[] {
  return values.map((value) => ({ label: value, value }));
}

function addDaysIso(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateText;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ReviewContributorList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; hours: number }>;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">{title}</p>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
              <PersonLink personName={row.name}>{row.name}</PersonLink>
              <span className="font-medium">{row.hours}h</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No logged hours</p>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const [phaseRoles, setPhaseRoles] = useState<string[]>([]);
  const [phaseUsers, setPhaseUsers] = useState<string[]>([]);
  const [phaseStartDate, setPhaseStartDate] = useState("");
  const [phaseEndDate, setPhaseEndDate] = useState("");
  const [timelinePhases, setTimelinePhases] = useState<string[]>([]);
  const [timelineRoles, setTimelineRoles] = useState<string[]>([]);
  const [timelineUsers, setTimelineUsers] = useState<string[]>([]);
  const [timelineStartDate, setTimelineStartDate] = useState("");
  const [timelineEndDate, setTimelineEndDate] = useState("");
  const phaseLabels = useAnimatedBarLabels({ labelKey: "phase", orientation: "x", barColor: "hsl(var(--chart-1))" });
  const reviewLabels = useAnimatedBarLabels({ labelKey: "bucket", orientation: "x", barColor: "hsl(var(--chart-3))" });
  const navigateToProjects = (params: Parameters<typeof navigateToProjectsFromChart>[1]) =>
    navigateToProjectsFromChart(navigate, params);

  const project = useMemo(
    () => (snapshot ? resolveProjectFromRoute(snapshot, params.reportingYear, params.projectSlug) : null),
    [params.projectSlug, params.reportingYear, snapshot],
  );
  const model = useMemo(
    () =>
      snapshot && project
        ? selectProjectDetailModel(snapshot, project.project_key, {
            phaseBreakdown: {
              roleGroups: phaseRoles,
              users: phaseUsers,
              startDate: phaseStartDate || null,
              endDate: phaseEndDate || null,
            },
            timeline: {
              phases: timelinePhases,
              roleGroups: timelineRoles,
              users: timelineUsers,
              startDate: timelineStartDate || null,
              endDate: timelineEndDate || null,
            },
          })
        : null,
    [
      phaseEndDate,
      phaseRoles,
      phaseStartDate,
      phaseUsers,
      project,
      snapshot,
      timelineEndDate,
      timelinePhases,
      timelineRoles,
      timelineStartDate,
      timelineUsers,
    ],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading project detail...</div>;
  }

  if (!snapshot || !project || !model) {
    return <NotFound />;
  }

  const backTarget = typeof location.state?.from === "string" ? location.state.from : "/projects";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => navigate(backTarget)}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{model.projectName}</h1>
              <Badge variant="secondary">{model.reportingYear}</Badge>
              <Badge variant="outline">{model.overview.status}</Badge>
            </div>
            <p className="max-w-3xl text-muted-foreground">
              Project detail combines the project record, matched time-log history, discrepancy visibility, and any available SME feedback without merging unlike metrics together.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Owners</p>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium">
                {model.overview.owners.length ? model.overview.owners.map((owner) => (
                  <PersonLink key={owner} personName={owner}>{owner}</PersonLink>
                )) : <span>Unassigned</span>}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">SME</p>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium">
                {model.overview.smeAssigned ? (
                  model.overview.smeAssigned
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => <PersonLink key={name} personName={name}>{name}</PersonLink>)
                ) : <span>None listed</span>}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Legal Reviewer</p>
              <p className="mt-1 text-sm font-medium">{model.overview.legalReviewer || "None listed"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Verticals</p>
              <p className="mt-1 text-sm font-medium">{model.overview.verticals.join(", ") || "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Course Type</p>
              <p className="mt-1 text-sm font-medium">{model.overview.courseType}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Authoring Tool</p>
              <p className="mt-1 text-sm font-medium">{model.overview.authoringTool}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Course Style</p>
              <p className="mt-1 text-sm font-medium">{model.overview.courseStyle}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Length / Interactions</p>
              <p className="mt-1 text-sm font-medium">
                {model.overview.courseLengthRaw}
                {model.overview.interactionCount ? ` • ${model.overview.interactionCount} interactions` : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          <SummaryCard label="Project Hours" value={`${model.hoursSummary.projectHours}h`} />
          <SummaryCard label="Logged Hours" value={`${model.hoursSummary.loggedHours}h`} />
          <SummaryCard
            label="Discrepancy"
            value={`${model.hoursSummary.discrepancyHours}h`}
            hint={model.hoursSummary.discrepancyFlag ? "Flagged for review" : "Within expected range"}
          />
        </div>
      </div>

      {model.hoursSummary.discrepancyFlag ? (
        <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Logged hours and project-record hours do not fully line up.</p>
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                Project records show {model.hoursSummary.projectHours}h while matched time logs show {model.hoursSummary.loggedHours}h.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ChartPanel title="Review Hours by Category and Assigned ID">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.reviewHours.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" interval={0} height={64} tick={reviewLabels.tick} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} {...reviewLabels.barHoverProps} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <ReviewContributorList title="Legal Review Contributors" rows={model.reviewHours.contributors.legalReview} />
            <ReviewContributorList title="CQO Review Contributors" rows={model.reviewHours.contributors.cqoReview} />
            <ReviewContributorList title="Team Review Contributors" rows={model.reviewHours.contributors.teamReview} />
          </div>
        </div>
      </ChartPanel>

      <ChartPanel
        title="Phase Breakdown"
        filters={
          <ChartFilterBar>
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Role" options={toOptions(model.chartFilterOptions.roleGroups)} selected={phaseRoles} onChange={setPhaseRoles} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="User" options={toOptions(model.chartFilterOptions.users)} selected={phaseUsers} onChange={setPhaseUsers} />
            <ChartDateRangeFilter startDate={phaseStartDate} endDate={phaseEndDate} onStartDateChange={setPhaseStartDate} onEndDateChange={setPhaseEndDate} />
          </ChartFilterBar>
        }
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.phaseBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="phase" tick={phaseLabels.tick} />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="hours"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(payload: unknown) => navigateToProjects({
                  project: project.project_key,
                  timePhase: getChartPayloadValue(payload, "phase"),
                  timeRole: phaseRoles,
                  timeUser: phaseUsers,
                  timeStart: phaseStartDate,
                  timeEnd: phaseEndDate,
                })}
                {...phaseLabels.barHoverProps}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel
        title={`Development Timeline (${model.timeline.granularity})`}
        filters={
          <ChartFilterBar>
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Phase" options={toOptions(model.chartFilterOptions.phases)} selected={timelinePhases} onChange={setTimelinePhases} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Role" options={toOptions(model.chartFilterOptions.roleGroups)} selected={timelineRoles} onChange={setTimelineRoles} />
            <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="User" options={toOptions(model.chartFilterOptions.users)} selected={timelineUsers} onChange={setTimelineUsers} />
            <ChartDateRangeFilter startDate={timelineStartDate} endDate={timelineEndDate} onStartDateChange={setTimelineStartDate} onEndDateChange={setTimelineEndDate} />
          </ChartFilterBar>
        }
      >
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.timeline.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={24} />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2.5}
                dot={{ r: 4, cursor: "pointer" }}
                activeDot={{ r: 6, cursor: "pointer" }}
                onClick={(payload: unknown) => {
                  const date = getChartPayloadValue(payload, "date");
                  navigateToProjects({
                    project: project.project_key,
                    timePhase: timelinePhases,
                    timeRole: timelineRoles,
                    timeUser: timelineUsers,
                    timeStart: date || timelineStartDate,
                    timeEnd: date ? (model.timeline.granularity === "weekly" ? addDaysIso(date, 6) : date) : timelineEndDate,
                  });
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">SME Feedback Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard label="ID Responses" value={String(model.smeFeedback.idResponseCount)} />
            <SummaryCard label="SME Responses" value={String(model.smeFeedback.smeResponseCount)} />
            <SummaryCard label="SME Satisfaction Avg" value={model.smeFeedback.averageSmeSatisfaction ? `${model.smeFeedback.averageSmeSatisfaction}` : "-"} />
            <SummaryCard label="Collaboration Avg" value={model.smeFeedback.averageOverallCollaborationRating ? `${model.smeFeedback.averageOverallCollaborationRating}` : "-"} />
            <SummaryCard label="Promoter Avg" value={model.smeFeedback.averagePromoterScore ? `${model.smeFeedback.averagePromoterScore}` : "-"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Project-hour percentile</p>
              <p className="mt-1 text-4xl font-bold">{model.comparison.percentileRank}%</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Projects with similar hours</p>
              <div className="space-y-2">
                {model.comparison.similarProjects.map((entry) => (
                  <div key={entry.projectKey} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <ProjectLink projectName={entry.projectName} reportingYear={entry.reportingYear}>
                        {entry.projectName}
                      </ProjectLink>
                      <p className="text-xs text-muted-foreground">{entry.reportingYear} • {entry.status}</p>
                    </div>
                    <span className="font-medium">{entry.projectTotalHours}h</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Designer Comments</CardTitle>
          </CardHeader>
          <CardContent>
            {model.smeFeedback.designerComments.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Designer</TableHead>
                    <TableHead>Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.smeFeedback.designerComments.map((row, index) => (
                    <TableRow key={`${row.author}-${row.date || index}`}>
                      <TableCell>{row.date || "-"}</TableCell>
                      <TableCell><PersonLink personName={row.author}>{row.author}</PersonLink></TableCell>
                      <TableCell>{row.comment}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No designer comments are attached to this project yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SME Responses</CardTitle>
          </CardHeader>
          <CardContent>
            {model.smeFeedback.smeResponses.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>SME</TableHead>
                    <TableHead>Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.smeFeedback.smeResponses.map((row, index) => (
                    <TableRow key={`${row.author}-${row.date || index}`}>
                      <TableCell>{row.date || "-"}</TableCell>
                      <TableCell><PersonLink personName={row.author}>{row.author}</PersonLink></TableCell>
                      <TableCell>{row.comment}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No SME comments are attached to this project yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
