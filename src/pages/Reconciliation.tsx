import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { useAuth } from "@/hooks/use-auth";
import { selectReconciliationModel } from "@/lib/analytics/selectors";
import { compactCourseName } from "@/lib/analytics/normalization";
import { makeId } from "@/lib/local-data-store";
import {
  upsertLocalCourseAlias,
  upsertLocalSmeManualJoin,
  upsertLocalWorkEntityDecision,
  upsertSharedCourseAlias,
  upsertSharedSmeManualJoin,
  upsertSharedWorkEntityDecision,
} from "@/lib/analytics/persistence";

const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
type ReconciliationModel = NonNullable<ReturnType<typeof selectReconciliationModel>>;
type ReconciliationTimeLogRow = ReconciliationModel["unmatchedOrReconcilableTimeLogs"][number];
type ReconciliationSmeJoinRow = ReconciliationModel["unresolvedSmeJoins"][number];

export default function Reconciliation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const model = useMemo(() => (snapshot ? selectReconciliationModel(snapshot) : null), [snapshot]);
  const [surveyTargetByRowId, setSurveyTargetByRowId] = useState<Record<string, string>>({});

  const canonicalProjects = snapshot?.canonicalProjects ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics_snapshot"] });
  };

  const persistProjectMatch = async (row: ReconciliationTimeLogRow) => {
    if (!snapshot || !row.suggestion) return;
    const targetProject = canonicalProjects.find((project) => project.project_key === row.suggestion?.target_project_key);
    if (!targetProject) return;

    const courseAliasRow = {
      id: makeId(),
      alias_title_raw: row.raw_course_name,
      alias_title_normalized: row.normalized_course_name,
      alias_title_compact: row.compact_course_name,
      canonical_title_raw: targetProject.raw_course_name,
      canonical_title_normalized: targetProject.normalized_course_name,
      canonical_title_compact: targetProject.compact_course_name,
      reporting_year: row.inferred_reporting_year,
      target_project_key: targetProject.project_key,
      alias_scope: "time_log" as const,
      notes: "Created from reconciliation suggestion acceptance",
      user_id: user?.id ?? null,
    };

    const decisionRow = {
      id: makeId(),
      source_title_raw: row.raw_course_name,
      source_title_normalized: row.normalized_course_name,
      source_title_compact: row.compact_course_name,
      reporting_year: row.inferred_reporting_year,
      decision_type: "project_match" as const,
      target_project_key: targetProject.project_key,
      standalone_title: null,
      notes: "Accepted suggestion from reconciliation workspace",
      user_id: user?.id ?? null,
    };

    if (DEV_BYPASS_AUTH) {
      await upsertLocalCourseAlias(courseAliasRow);
      await upsertLocalWorkEntityDecision(decisionRow);
    } else {
      await upsertSharedCourseAlias(courseAliasRow);
      await upsertSharedWorkEntityDecision(decisionRow);
    }

    invalidate();
    toast.success("Saved project match decision.");
  };

  const persistClassification = async (
    row: ReconciliationTimeLogRow,
    decisionType: "standalone_course" | "non_project_work",
  ) => {
    const decisionRow = {
      id: makeId(),
      source_title_raw: row.raw_course_name,
      source_title_normalized: row.normalized_course_name,
      source_title_compact: row.compact_course_name,
      reporting_year: row.inferred_reporting_year,
      decision_type: decisionType,
      target_project_key: null,
      standalone_title: decisionType === "standalone_course" ? row.raw_course_name : null,
      notes: `Saved from reconciliation workspace as ${decisionType}`,
      user_id: user?.id ?? null,
    };

    if (DEV_BYPASS_AUTH) {
      await upsertLocalWorkEntityDecision(decisionRow);
    } else {
      await upsertSharedWorkEntityDecision(decisionRow);
    }

    invalidate();
    toast.success(`Saved ${decisionType} classification.`);
  };

  const persistSmeOverride = async (row: ReconciliationSmeJoinRow) => {
    const selectedProjectKey = surveyTargetByRowId[row.raw_sme_feedback_row_id];
    if (!selectedProjectKey) return;

    const overrideRow = {
      id: makeId(),
      course_key_compact: compactCourseName(row.course_key_raw),
      course_name_compact: compactCourseName(row.course_name_raw),
      reporting_year: row.reporting_year,
      target_project_key: selectedProjectKey,
      notes: "Created from reconciliation workspace",
      user_id: user?.id ?? null,
    };

    if (DEV_BYPASS_AUTH) {
      await upsertLocalSmeManualJoin(overrideRow);
    } else {
      await upsertSharedSmeManualJoin(overrideRow);
    }

    invalidate();
    toast.success("Saved SME manual join override.");
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading reconciliation workspace...</div>;
  }

  if (!snapshot || !model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No reconciliation data is available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reconciliation</h1>
        <p className="text-muted-foreground">
          Admin workspace for duplicate project keys, unmatched time logs, unresolved SME joins, alias rules, discrepancy flags, and synthetic work entities.
        </p>
      </div>

      <Tabs defaultValue="time-logs" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="time-logs">Time Logs</TabsTrigger>
          <TabsTrigger value="standalone">Standalone</TabsTrigger>
          <TabsTrigger value="non-project">Non-Project</TabsTrigger>
          <TabsTrigger value="sme">SME Joins</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="configs">Configs</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          <TabsTrigger value="entities">Synthetic Entities</TabsTrigger>
        </TabsList>

        <TabsContent value="time-logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unmatched / Reconcilable Time Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Suggested Match</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.unmatchedOrReconcilableTimeLogs.map((row) => (
                    <TableRow key={row.raw_time_log_row_id}>
                      <TableCell>{row.raw_course_name}</TableCell>
                      <TableCell>{row.inferred_reporting_year || "-"}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell>{row.suggestion?.candidate_title || "-"}</TableCell>
                      <TableCell>{row.suggestion?.confidence || "-"}</TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" disabled={!row.suggestion} onClick={() => persistProjectMatch(row)}>
                          Accept Suggestion
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => persistClassification(row, "standalone_course")}>
                          Mark Standalone
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => persistClassification(row, "non_project_work")}>
                          Mark Non-Project
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standalone">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Standalone Course Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.standaloneCourseCandidates.map((row) => (
                    <TableRow key={row.raw_time_log_row_id}>
                      <TableCell>{row.raw_course_name}</TableCell>
                      <TableCell>{row.inferred_reporting_year || "-"}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="non-project">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Non-Project Work Classifications</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.nonProjectWorkCandidates.map((row) => (
                    <TableRow key={row.raw_time_log_row_id}>
                      <TableCell>{row.raw_course_name}</TableCell>
                      <TableCell>{row.inferred_reporting_year || "-"}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sme">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unresolved and Ambiguous SME Joins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[...model.unresolvedSmeJoins, ...model.ambiguousSmeJoins].map((row) => (
                <div key={row.raw_sme_feedback_row_id} className="rounded-md border p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Course Name</p>
                      <p className="text-sm font-medium">{row.course_name_raw}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Course Key</p>
                      <p className="text-sm font-medium">{row.course_key_raw || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Year</p>
                      <p className="text-sm font-medium">{row.reporting_year || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Join Status</p>
                      <p className="text-sm font-medium">{row.join_status}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      className="min-w-[340px] rounded-md border bg-background px-3 py-2 text-sm"
                      value={surveyTargetByRowId[row.raw_sme_feedback_row_id] || ""}
                      onChange={(event) =>
                        setSurveyTargetByRowId((current) => ({
                          ...current,
                          [row.raw_sme_feedback_row_id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select canonical project...</option>
                      {canonicalProjects.map((project) => (
                        <option key={project.project_key} value={project.project_key}>
                          {project.project_key} - {project.raw_course_name}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => persistSmeOverride(row)}>
                      Save Manual Join
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Duplicate Canonical Project Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Key</TableHead>
                    <TableHead>Kept Row</TableHead>
                    <TableHead>Discarded Row</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.duplicateProjects.map((row) => (
                    <TableRow key={`${row.kept_row_id}-${row.discarded_row_id}`}>
                      <TableCell>{row.project_key}</TableCell>
                      <TableCell>{row.kept_row_id}</TableCell>
                      <TableCell>{row.discarded_row_id}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configs">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course Aliases</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alias</TableHead>
                      <TableHead>Canonical</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.aliasUsage.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.alias_title_raw}</TableCell>
                        <TableCell>{row.canonical_title_raw}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Person Aliases</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alias</TableHead>
                      <TableHead>Canonical</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.personAliases.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.alias_name_raw}</TableCell>
                        <TableCell>{row.canonical_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Person Role Overrides</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Role Group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.personRoleOverrides.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.canonical_name}</TableCell>
                        <TableCell>{row.role_group}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="discrepancies">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hours Discrepancy Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Key</TableHead>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Project Minutes</TableHead>
                    <TableHead>Logged Minutes</TableHead>
                    <TableHead>Difference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.discrepancyFlags.map((project) => (
                    <TableRow key={project.project_key}>
                      <TableCell>{project.project_key}</TableCell>
                      <TableCell>{project.raw_course_name}</TableCell>
                      <TableCell>{project.project_total_minutes}</TableCell>
                      <TableCell>{project.time_log_minutes_sum}</TableCell>
                      <TableCell>{project.hours_discrepancy_minutes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entities">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Synthetic Work Entities Created From Time Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity Key</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>User Confirmed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.syntheticWorkEntities.map((entity) => (
                    <TableRow key={entity.work_entity_key}>
                      <TableCell>{entity.work_entity_key}</TableCell>
                      <TableCell>{entity.entity_type}</TableCell>
                      <TableCell>{entity.raw_title}</TableCell>
                      <TableCell>{entity.reporting_year || "-"}</TableCell>
                      <TableCell>{entity.is_user_confirmed ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
