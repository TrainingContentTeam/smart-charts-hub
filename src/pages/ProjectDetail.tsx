import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartPanel } from "@/components/ChartPanel";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { resolveProjectFromRoute } from "@/lib/analytics/project-routing";
import { selectProjectDetailModel } from "@/lib/analytics/selectors";
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

export default function ProjectDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();

  const project = useMemo(
    () => (snapshot ? resolveProjectFromRoute(snapshot, params.reportingYear, params.projectSlug) : null),
    [params.projectSlug, params.reportingYear, snapshot],
  );
  const model = useMemo(
    () => (snapshot && project ? selectProjectDetailModel(snapshot, project.project_key) : null),
    [project, snapshot],
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
              <p className="mt-1 text-sm font-medium">{model.overview.owners.join(", ") || "Unassigned"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">SME</p>
              <p className="mt-1 text-sm font-medium">{model.overview.smeAssigned || "None listed"}</p>
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
        <Card className="border-amber-300 bg-amber-50/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium text-amber-900">Logged hours and project-record hours do not fully line up.</p>
              <p className="text-sm text-amber-900/80">
                Project records show {model.hoursSummary.projectHours}h while matched time logs show {model.hoursSummary.loggedHours}h.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ChartPanel title="Phase Breakdown">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.phaseBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="phase" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel title={`Development Timeline (${model.timeline.granularity})`}>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={model.timeline.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" minTickGap={24} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="hours" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={false} />
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
                      <TableCell>{row.author}</TableCell>
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
                      <TableCell>{row.author}</TableCell>
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
