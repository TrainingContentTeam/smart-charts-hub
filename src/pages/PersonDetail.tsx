import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartPanel } from "@/components/ChartPanel";
import { CHART_FILTER_VARIANT, ChartFilterBar } from "@/components/ChartFilters";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { resolvePersonNameFromRoute } from "@/lib/analytics/person-routing";
import { selectPersonDetailModel } from "@/lib/analytics/selectors";
import NotFound from "./NotFound";

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

function toOptions(values: string[]): CompactFilterOption[] {
  return values.map((value) => ({ label: value, value }));
}

function chartHeight(count: number, minimum = 320, maximum = 560) {
  return Math.max(minimum, Math.min(maximum, count * 38 + 120));
}

export default function PersonDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const [statusYears, setStatusYears] = useState<string[]>([]);
  const [statusTools, setStatusTools] = useState<string[]>([]);
  const [statusTypes, setStatusTypes] = useState<string[]>([]);
  const [phaseYears, setPhaseYears] = useState<string[]>([]);
  const [phaseTools, setPhaseTools] = useState<string[]>([]);
  const [phaseTypes, setPhaseTypes] = useState<string[]>([]);
  const [phaseRoles, setPhaseRoles] = useState<string[]>([]);

  const canonicalName = useMemo(
    () => (snapshot ? resolvePersonNameFromRoute(snapshot, params.personSlug) : null),
    [params.personSlug, snapshot],
  );
  const model = useMemo(
    () =>
      snapshot && canonicalName
        ? selectPersonDetailModel(snapshot, canonicalName, {
            idStatusBreakdown: {
              reportingYears: statusYears,
              authoringTools: statusTools,
              courseTypes: statusTypes,
            },
            idPhaseBreakdown: {
              reportingYears: phaseYears,
              authoringTools: phaseTools,
              courseTypes: phaseTypes,
              roleGroups: phaseRoles,
            },
          })
        : null,
    [canonicalName, phaseRoles, phaseTools, phaseTypes, phaseYears, snapshot, statusTools, statusTypes, statusYears],
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading person detail...</div>;
  }

  if (!snapshot || !canonicalName || !model) {
    return <NotFound />;
  }

  const backTarget = typeof location.state?.from === "string" ? location.state.from : "/";

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
              <h1 className="text-3xl font-bold tracking-tight">{model.canonicalName}</h1>
              {model.roles.map((role) => (
                <Badge key={role} variant="secondary">{role}</Badge>
              ))}
              {model.overview.internalStatus !== "Unknown" ? (
                <Badge variant="outline">{model.overview.internalStatus}</Badge>
              ) : null}
            </div>
            <p className="max-w-3xl text-muted-foreground">
              This page brings together project ownership, contribution history, matched time logs, and the correct survey instruments for this person without merging unlike metrics together.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="id">ID</TabsTrigger>
          <TabsTrigger value="sme">SME</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Assigned Projects" value={model.overview.assignedProjects} />
            <SummaryCard label="Contributed Projects" value={model.overview.contributedProjects} />
            <SummaryCard label="ID Surveys" value={model.overview.idSurveyCount} />
            <SummaryCard label="SME Surveys" value={model.overview.smeSurveyCount} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Project Relationships</CardTitle>
              </CardHeader>
              <CardContent>
                {model.overview.recentProjects.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Relationship</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {model.overview.recentProjects.map((project) => (
                        <TableRow key={project.projectKey}>
                          <TableCell>
                            <ProjectLink projectName={project.projectName} reportingYear={project.reportingYear}>
                              {project.projectName}
                            </ProjectLink>
                          </TableCell>
                          <TableCell>{project.reportingYear}</TableCell>
                          <TableCell>{project.status}</TableCell>
                          <TableCell>{project.relationships.join(", ")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No project relationships are attached to this person yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Observed Names</p>
                  <p className="mt-1 text-sm font-medium">{model.overview.observedNames.join(", ")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Active Projects</p>
                  <p className="mt-1 text-2xl font-bold">{model.overview.activeProjects}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Completed Projects</p>
                  <p className="mt-1 text-2xl font-bold">{model.overview.completedProjects}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Internal Status</p>
                  <p className="mt-1 text-sm font-medium">{model.overview.internalStatus}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="id" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Assigned Projects" value={model.idView.assignedProjectCount} />
            <SummaryCard label="Active / Completed" value={`${model.idView.activeProjectCount} / ${model.idView.completedProjectCount}`} />
            <SummaryCard label="Matched Logged Hours" value={`${model.idView.matchedLoggedHoursOnOwnedProjects}h`} />
            <SummaryCard
              label="Dev Hours per Content Hour"
              value={model.idView.developmentHoursPerContentHour ?? "-"}
              hint="Uses matched logged hours and parsed course length where available."
            />
            <SummaryCard label="ID Surveys" value={model.idView.idSurveyCount} />
            <SummaryCard label="SME Experience Surveys" value={model.idView.smeExperienceSurveyCount} />
            <SummaryCard label="Avg SME Experience Score" value={model.idView.averageSmeExperienceScore || "-"} />
            <SummaryCard label="Avg Recommend Score" value={model.idView.averageSmeRecommendScore || "-"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartPanel
              title="Assigned Projects by Status"
              filters={
                <ChartFilterBar>
                  <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Year" options={toOptions(model.idView.chartFilterOptions.reportingYears)} selected={statusYears} onChange={setStatusYears} />
                  <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Tool" options={toOptions(model.idView.chartFilterOptions.authoringTools)} selected={statusTools} onChange={setStatusTools} />
                  <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Type" options={toOptions(model.idView.chartFilterOptions.courseTypes)} selected={statusTypes} onChange={setStatusTypes} />
                </ChartFilterBar>
              }
            >
              <div style={{ height: chartHeight(model.idView.statusBreakdown.length) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={model.idView.statusBreakdown} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="status" width={170} interval={0} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>

            <ChartPanel
              title="Owned Project Hours by Phase"
              filters={
                <ChartFilterBar>
                  <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Year" options={toOptions(model.idView.chartFilterOptions.reportingYears)} selected={phaseYears} onChange={setPhaseYears} />
                  <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Tool" options={toOptions(model.idView.chartFilterOptions.authoringTools)} selected={phaseTools} onChange={setPhaseTools} />
                  <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Type" options={toOptions(model.idView.chartFilterOptions.courseTypes)} selected={phaseTypes} onChange={setPhaseTypes} />
                  <CompactMultiSelectFilter variant={CHART_FILTER_VARIANT} label="Role" options={toOptions(model.idView.chartFilterOptions.roleGroups)} selected={phaseRoles} onChange={setPhaseRoles} />
                </ChartFilterBar>
              }
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={model.idView.phaseBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="phase" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Owned Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {model.idView.ownedProjects.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Project Hours</TableHead>
                      <TableHead>Logged Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.idView.ownedProjects.map((project) => (
                      <TableRow key={project.projectKey}>
                        <TableCell>
                          <ProjectLink projectName={project.projectName} reportingYear={project.reportingYear}>
                            {project.projectName}
                          </ProjectLink>
                        </TableCell>
                        <TableCell>{project.reportingYear}</TableCell>
                        <TableCell>{project.projectHours}</TableCell>
                        <TableCell>{project.loggedHours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">This person is not currently listed as an instructional designer on any project records.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SME Feedback About This ID</CardTitle>
            </CardHeader>
            <CardContent>
              {model.idView.feedbackRows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>SME</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Avg Score</TableHead>
                      <TableHead>Comment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.idView.feedbackRows.map((row) => (
                      <TableRow key={row.rawSmeFeedbackRowId}>
                        <TableCell>
                          {row.projectKey ? (
                            <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                              {row.projectName}
                            </ProjectLink>
                          ) : row.projectName}
                        </TableCell>
                        <TableCell>
                          <PersonLink personName={row.sme}>{row.sme}</PersonLink>
                        </TableCell>
                        <TableCell>{row.surveyDate || "-"}</TableCell>
                        <TableCell>{row.averageScore || "-"}</TableCell>
                        <TableCell>{row.comment || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No SME-facing experience surveys are tied to this instructional designer yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sme" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Internal Status" value={model.smeView.internalStatus} />
            <SummaryCard label="SME Surveys" value={model.smeView.surveyCount} />
            <SummaryCard label="ID Evaluations" value={model.smeView.evaluationCount} />
            <SummaryCard label="Contributed Projects" value={model.smeView.contributedProjectCount} />
            <SummaryCard label="Matched Project Hours" value={`${model.smeView.matchedProjectHours}h`} />
            <SummaryCard label="Hours Worked" value={model.smeView.hoursWorked} />
            <SummaryCard label="Amount Billed" value={model.smeView.amountBilled} />
            <SummaryCard label="Avg Lexipol Experience" value={model.smeView.averageLexipolExperienceScore || "-"} />
            <SummaryCard label="Avg ID Evaluation" value={model.smeView.averageIdEvaluationScore || "-"} />
            <SummaryCard label="Avg Promoter Score" value={model.smeView.averageIdPromoterScore || "-"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contributed Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {model.smeView.contributedProjects.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Project Hours</TableHead>
                      <TableHead>Logged Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.smeView.contributedProjects.map((project) => (
                      <TableRow key={project.projectKey}>
                        <TableCell>
                          <ProjectLink projectName={project.projectName} reportingYear={project.reportingYear}>
                            {project.projectName}
                          </ProjectLink>
                        </TableCell>
                        <TableCell>{project.reportingYear}</TableCell>
                        <TableCell>{project.projectHours}</TableCell>
                        <TableCell>{project.loggedHours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No project participation has been attached to this SME yet.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SME Survey Responses</CardTitle>
              </CardHeader>
              <CardContent>
                {model.smeView.surveyRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Internal</TableHead>
                        <TableHead>SME Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {model.smeView.surveyRows.map((row) => (
                        <TableRow key={row.rawSmeFeedbackRowId}>
                          <TableCell>
                            {row.projectKey ? (
                              <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                                {row.projectName}
                              </ProjectLink>
                            ) : row.projectName}
                          </TableCell>
                          <TableCell>
                            <PersonLink personName={row.instructionalDesigner}>{row.instructionalDesigner}</PersonLink>
                          </TableCell>
                          <TableCell>{row.surveyDate || "-"}</TableCell>
                          <TableCell>{row.internal}</TableCell>
                          <TableCell>{row.comment || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No SME-facing survey responses are attached to this person yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ID Evaluations of This SME</CardTitle>
              </CardHeader>
              <CardContent>
                {model.smeView.evaluationRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Overall Rating</TableHead>
                        <TableHead>Promoter</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {model.smeView.evaluationRows.map((row) => (
                        <TableRow key={row.rawSmeFeedbackRowId}>
                          <TableCell>
                            {row.projectKey ? (
                              <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                                {row.projectName}
                              </ProjectLink>
                            ) : row.projectName}
                          </TableCell>
                          <TableCell>
                            <PersonLink personName={row.instructionalDesigner}>{row.instructionalDesigner}</PersonLink>
                          </TableCell>
                          <TableCell>{row.surveyDate || "-"}</TableCell>
                          <TableCell>{row.overallRating || "-"}</TableCell>
                          <TableCell>{row.promoterScore || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No instructional-designer evaluations are attached to this SME yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
