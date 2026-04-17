import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Clock3, Link2, Save, ShieldAlert, Tag, Undo2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionIconButton } from "@/components/ActionIconButton";
import { BulkActionBar } from "@/components/BulkActionBar";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { useAuth } from "@/hooks/use-auth";
import { compactCourseName } from "@/lib/analytics/normalization";
import { selectGroupedReconciliationModel } from "@/lib/analytics/selectors";
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
type GroupedModel = NonNullable<ReturnType<typeof selectGroupedReconciliationModel>>;
type ReconciliationGroup = GroupedModel["timeLogGroups"][number];
type ReconciliationGroupRow = ReconciliationGroup["rows"][number];
type ReconciliationSmeJoinRow = GroupedModel["smeJoinRows"][number];

function uniqueSelectedRows(
  group: ReconciliationGroup,
  selectedById: Record<string, boolean>,
  deferredById: Record<string, boolean>,
) {
  const visibleRows = group.rows.filter((row) => !deferredById[row.raw_time_log_row_id]);
  const selected = visibleRows.filter((row) => selectedById[row.raw_time_log_row_id]);
  return selected.length ? selected : visibleRows;
}

function commonSuggestionKey(rows: ReconciliationGroupRow[]) {
  const keys = [...new Set(rows.map((row) => row.suggestion?.target_project_key).filter(Boolean))];
  return keys.length === 1 && rows.every((row) => row.suggestion?.target_project_key === keys[0]) ? keys[0] : null;
}

export default function Reconciliation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const model = useMemo(() => (snapshot ? selectGroupedReconciliationModel(snapshot) : null), [snapshot]);

  const [surveyTargetByRowId, setSurveyTargetByRowId] = useState<Record<string, string>>({});
  const [timeLogSelection, setTimeLogSelection] = useState<Record<string, boolean>>({});
  const [standaloneSelection, setStandaloneSelection] = useState<Record<string, boolean>>({});
  const [nonProjectSelection, setNonProjectSelection] = useState<Record<string, boolean>>({});
  const [deferredById, setDeferredById] = useState<Record<string, boolean>>({});
  const [standaloneEdits, setStandaloneEdits] = useState<Record<string, { standardizedTitle: string; reportingYear: string; classification: "standalone_course" | "non_project_work" }>>({});

  const canonicalProjects = snapshot?.canonicalProjects ?? [];
  const canonicalProjectOptions = useMemo(
    () =>
      canonicalProjects
        .map((project) => ({
          value: project.project_key,
          projectName: project.raw_course_name,
          reportingYear: project.reporting_year || "Unknown",
          label: `${project.raw_course_name} (${project.reporting_year || "Unknown"})`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [canonicalProjects],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics_snapshot"] });
  };

  const persistProjectMatch = async (rows: ReconciliationGroupRow[], targetProjectKey: string) => {
    if (!snapshot || !rows.length) return;
    const targetProject = canonicalProjects.find((project) => project.project_key === targetProjectKey);
    if (!targetProject) return;

    const writes = rows.flatMap((row) => {
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
        notes: "Created from grouped reconciliation match acceptance",
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
        notes: "Accepted grouped suggestion from reconciliation workspace",
        user_id: user?.id ?? null,
      };

      return DEV_BYPASS_AUTH
        ? [upsertLocalCourseAlias(courseAliasRow), upsertLocalWorkEntityDecision(decisionRow)]
        : [upsertSharedCourseAlias(courseAliasRow), upsertSharedWorkEntityDecision(decisionRow)];
    });

    await Promise.all(writes);
    invalidate();
    toast.success(`Saved ${rows.length} project match ${rows.length === 1 ? "decision" : "decisions"}.`);
  };

  const persistClassification = async (
    rows: ReconciliationGroupRow[],
    decisionType: "standalone_course" | "non_project_work",
    options?: { standardizedTitle?: string; reportingYear?: string | null },
  ) => {
    if (!rows.length) return;

    const writes = rows.map((row) => {
      const decisionRow = {
        id: makeId(),
        source_title_raw: row.raw_course_name,
        source_title_normalized: row.normalized_course_name,
        source_title_compact: row.compact_course_name,
        reporting_year: options?.reportingYear || row.inferred_reporting_year,
        decision_type: decisionType,
        target_project_key: null,
        standalone_title: decisionType === "standalone_course" ? (options?.standardizedTitle?.trim() || row.raw_course_name) : null,
        notes: `Saved from grouped reconciliation workspace as ${decisionType}`,
        user_id: user?.id ?? null,
      };

      return DEV_BYPASS_AUTH
        ? upsertLocalWorkEntityDecision(decisionRow)
        : upsertSharedWorkEntityDecision(decisionRow);
    });

    await Promise.all(writes);
    invalidate();
    toast.success(`Saved ${rows.length} ${decisionType === "standalone_course" ? "standalone" : "non-project"} ${rows.length === 1 ? "classification" : "classifications"}.`);
  };

  const persistSmeOverride = async (row: ReconciliationSmeJoinRow, targetProjectKey: string) => {
    const overrideRow = {
      id: makeId(),
      course_key_compact: compactCourseName(row.course_key_raw),
      course_name_compact: compactCourseName(row.course_name_raw),
      reporting_year: row.reporting_year,
      target_project_key: targetProjectKey,
      notes: "Created from reconciliation workspace",
      user_id: user?.id ?? null,
    };

    if (DEV_BYPASS_AUTH) {
      await upsertLocalSmeManualJoin(overrideRow);
    } else {
      await upsertSharedSmeManualJoin(overrideRow);
    }

    invalidate();
    toast.success("Saved persistent SME match.");
  };

  const toggleRowSelection = (
    setter: Dispatch<SetStateAction<Record<string, boolean>>>,
    rowId: string,
  ) => {
    setter((current) => ({ ...current, [rowId]: !current[rowId] }));
  };

  const toggleGroupSelection = (
    setter: Dispatch<SetStateAction<Record<string, boolean>>>,
    group: ReconciliationGroup,
    deferredMap: Record<string, boolean>,
  ) => {
    setter((current) => {
      const visibleRows = group.rows.filter((row) => !deferredMap[row.raw_time_log_row_id]);
      const allSelected = visibleRows.every((row) => current[row.raw_time_log_row_id]);
      const next = { ...current };
      visibleRows.forEach((row) => {
        next[row.raw_time_log_row_id] = !allSelected;
      });
      return next;
    });
  };

  const renderTimeLogGroup = (
    group: ReconciliationGroup,
    selection: Record<string, boolean>,
    setSelection: Dispatch<SetStateAction<Record<string, boolean>>>,
    actionOptions?: { showStandalone?: boolean; showNonProject?: boolean; sectionTitle?: string },
  ) => {
    const activeRows = uniqueSelectedRows(group, selection, deferredById);
    const sharedSuggestionKey = commonSuggestionKey(activeRows);
    const visibleRows = group.rows.filter((row) => !deferredById[row.raw_time_log_row_id]);
    const deferredCount = group.rows.length - visibleRows.length;
    const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selection[row.raw_time_log_row_id]);
    const someSelected = visibleRows.some((row) => selection[row.raw_time_log_row_id]);

    return (
      <Card key={group.groupKey}>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  aria-label={`Select group ${group.title}`}
                  onCheckedChange={() => toggleGroupSelection(setSelection, group, deferredById)}
                />
                <CardTitle className="text-base">{group.title}</CardTitle>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {group.rowCount} rows
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {group.totalHours}h
                </span>
                {group.years.map((year) => (
                  <span key={year} className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {year}
                  </span>
                ))}
              </div>
              {group.topSuggestion ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Top suggestion:</span>
                  <ProjectLink projectName={group.topSuggestion.projectName} reportingYear={group.topSuggestion.reportingYear}>
                    {group.topSuggestion.projectName}
                  </ProjectLink>
                  <ConfidenceBadge confidence={group.topSuggestion.confidence} />
                </div>
              ) : null}
            </div>

            {deferredCount ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDeferredById((current) => {
                    const next = { ...current };
                    group.rows.forEach((row) => delete next[row.raw_time_log_row_id]);
                    return next;
                  })
                }
              >
                <Undo2 className="h-4 w-4" />
                <span>Undo Defer ({deferredCount})</span>
              </Button>
            ) : null}
          </div>

          <BulkActionBar selectedCount={activeRows.length}>
            <ActionIconButton
              icon={Link2}
              label="Accept Suggested Match"
              tooltip="Create a persistent project mapping for the selected rows."
              variant="default"
              size="sm"
              disabled={!sharedSuggestionKey}
              onClick={() => sharedSuggestionKey && persistProjectMatch(activeRows, sharedSuggestionKey)}
            />
            {actionOptions?.showStandalone !== false ? (
              <ActionIconButton
                icon={Tag}
                label="Standalone (Single Video / Other)"
                tooltip="Mark these rows as course-like work that is not present in project exports."
                variant="outline"
                size="sm"
                onClick={() => persistClassification(activeRows, "standalone_course")}
              />
            ) : null}
            {actionOptions?.showNonProject !== false ? (
              <ActionIconButton
                icon={ShieldAlert}
                label="Non-Project"
                tooltip="Mark these rows as operational or support work that should not map to a course project."
                variant="outline"
                size="sm"
                onClick={() => persistClassification(activeRows, "non_project_work")}
              />
            ) : null}
            <ActionIconButton
              icon={Clock3}
              label="Defer"
              tooltip="Hide the selected rows for this session without saving a persistent decision."
              variant="ghost"
              size="sm"
              onClick={() =>
                setDeferredById((current) => {
                  const next = { ...current };
                  activeRows.forEach((row) => {
                    next[row.raw_time_log_row_id] = true;
                  });
                  return next;
                })
              }
            />
          </BulkActionBar>
        </CardHeader>

        <CardContent>
          {visibleRows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Course Title</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Suggested Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.raw_time_log_row_id}>
                    <TableCell>
                      <Checkbox
                        checked={selection[row.raw_time_log_row_id] || false}
                        aria-label={`Select ${row.raw_course_name}`}
                        onCheckedChange={() => toggleRowSelection(setSelection, row.raw_time_log_row_id)}
                      />
                    </TableCell>
                    <TableCell>{row.raw_course_name}</TableCell>
                    <TableCell>{row.logDate || "-"}</TableCell>
                    <TableCell>{row.user}</TableCell>
                    <TableCell>{row.hours}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                    <TableCell>
                      {row.suggestion ? (
                        <div className="flex items-center gap-2">
                          <span>{row.suggestion.candidate_title}</span>
                          <ConfidenceBadge confidence={row.suggestion.confidence} />
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">All rows in this group are deferred for this session.</p>
          )}
        </CardContent>
      </Card>
    );
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
          Review grouped time-log naming issues, persistent SME matches, discrepancy flags, aliases, and synthetic work entities without forcing ambiguous records into the wrong place.
        </p>
      </div>

      <Tabs defaultValue="time-logs" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="time-logs">Time Logs</TabsTrigger>
          <TabsTrigger value="standalone">Standalone</TabsTrigger>
          <TabsTrigger value="non-project">Non-Project</TabsTrigger>
          <TabsTrigger value="sme">SME Joins</TabsTrigger>
          <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
          <TabsTrigger value="configs">Configs</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          <TabsTrigger value="entities">Synthetic Entities</TabsTrigger>
        </TabsList>

        <TabsContent value="time-logs" className="space-y-4">
          {model.timeLogGroups.map((group) => renderTimeLogGroup(group, timeLogSelection, setTimeLogSelection))}
        </TabsContent>

        <TabsContent value="standalone" className="space-y-4">
          {model.standaloneGroups.map((group) => {
            const editState = standaloneEdits[group.groupKey] || {
              standardizedTitle: group.title,
              reportingYear: group.years[0] || "",
              classification: "standalone_course" as const,
            };
            const selectedRows = uniqueSelectedRows(group, standaloneSelection, deferredById);
            const visibleRows = group.rows.filter((row) => !deferredById[row.raw_time_log_row_id]);
            const allSelected = visibleRows.length > 0 && visibleRows.every((row) => standaloneSelection[row.raw_time_log_row_id]);
            const someSelected = visibleRows.some((row) => standaloneSelection[row.raw_time_log_row_id]);

            return (
              <Card key={group.groupKey}>
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      aria-label={`Select standalone group ${group.title}`}
                      onCheckedChange={() => toggleGroupSelection(setStandaloneSelection, group, deferredById)}
                    />
                    <CardTitle className="text-base">{group.title}</CardTitle>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {group.rowCount} rows
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {group.totalHours}h
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Standardized Title</span>
                      <Input
                        value={editState.standardizedTitle}
                        onChange={(event) =>
                          setStandaloneEdits((current) => ({
                            ...current,
                            [group.groupKey]: { ...editState, standardizedTitle: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Reporting Year</span>
                      <Input
                        value={editState.reportingYear}
                        onChange={(event) =>
                          setStandaloneEdits((current) => ({
                            ...current,
                            [group.groupKey]: { ...editState, reportingYear: event.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Classification</span>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={editState.classification}
                        onChange={(event) =>
                          setStandaloneEdits((current) => ({
                            ...current,
                            [group.groupKey]: {
                              ...editState,
                              classification: event.target.value as "standalone_course" | "non_project_work",
                            },
                          }))
                        }
                      >
                        <option value="standalone_course">Standalone (Single Video / Other)</option>
                        <option value="non_project_work">Non-Project</option>
                      </select>
                    </div>
                  </div>

                  <BulkActionBar selectedCount={selectedRows.length}>
                    <ActionIconButton
                      icon={Save}
                      label="Apply to Selected"
                      tooltip="Save this grouped title, year, and classification for the selected rows."
                      variant="default"
                      size="sm"
                      onClick={() =>
                        persistClassification(selectedRows, editState.classification, {
                          standardizedTitle: editState.standardizedTitle,
                          reportingYear: editState.reportingYear || null,
                        })
                      }
                    />
                    <ActionIconButton
                      icon={Clock3}
                      label="Defer"
                      tooltip="Hide the selected rows for this session without saving a persistent decision."
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDeferredById((current) => {
                          const next = { ...current };
                          selectedRows.forEach((row) => {
                            next[row.raw_time_log_row_id] = true;
                          });
                          return next;
                        })
                      }
                    />
                  </BulkActionBar>
                </CardHeader>

                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead />
                        <TableHead>Course Title</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((row) => (
                        <TableRow key={row.raw_time_log_row_id}>
                          <TableCell>
                            <Checkbox
                              checked={standaloneSelection[row.raw_time_log_row_id] || false}
                              aria-label={`Select ${row.raw_course_name}`}
                              onCheckedChange={() => toggleRowSelection(setStandaloneSelection, row.raw_time_log_row_id)}
                            />
                          </TableCell>
                          <TableCell>{row.raw_course_name}</TableCell>
                          <TableCell>{row.logDate || "-"}</TableCell>
                          <TableCell>{row.user}</TableCell>
                          <TableCell>{row.hours}</TableCell>
                          <TableCell>{row.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="non-project" className="space-y-4">
          {model.nonProjectGroups.map((group) =>
            renderTimeLogGroup(group, nonProjectSelection, setNonProjectSelection, {
              showNonProject: true,
              showStandalone: true,
            }),
          )}
        </TabsContent>

        <TabsContent value="sme">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unresolved and Ambiguous SME Joins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {model.smeJoinRows.map((row) => {
                const selectedProjectKey = surveyTargetByRowId[row.raw_sme_feedback_row_id] || row.suggestedProject?.projectKey || "";

                return (
                  <div key={row.raw_sme_feedback_row_id} className="space-y-3 rounded-lg border p-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Course Name</p>
                        <p className="mt-1 text-sm font-medium">{row.course_name_raw}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Course Key</p>
                        <p className="mt-1 text-sm font-medium">{row.course_key_raw || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Year</p>
                        <p className="mt-1 text-sm font-medium">{row.reporting_year || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Join Status</p>
                        <p className="mt-1 text-sm font-medium">{row.join_status}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {row.suggestedProject ? (
                        <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
                          <span className="text-muted-foreground">Suggested:</span>
                          <ProjectLink projectName={row.suggestedProject.projectName} reportingYear={row.suggestedProject.reportingYear}>
                            {row.suggestedProject.projectName}
                          </ProjectLink>
                          <ConfidenceBadge confidence={row.suggestedProject.confidence} />
                        </div>
                      ) : (
                        <div className="rounded-full border px-3 py-1.5 text-sm text-muted-foreground">
                          No safe suggestion yet
                        </div>
                      )}

                      <select
                        className="min-w-[340px] rounded-md border bg-background px-3 py-2 text-sm"
                        value={selectedProjectKey}
                        onChange={(event) =>
                          setSurveyTargetByRowId((current) => ({
                            ...current,
                            [row.raw_sme_feedback_row_id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select project record...</option>
                        {canonicalProjectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {row.suggestedProject ? (
                        <ActionIconButton
                          icon={Link2}
                          label="Accept Suggested Match"
                          tooltip="Use the suggested project for this survey row."
                          variant="default"
                          size="sm"
                          onClick={() => persistSmeOverride(row, row.suggestedProject!.projectKey)}
                        />
                      ) : null}
                      <ActionIconButton
                        icon={Save}
                        label="Save Persistent Match"
                        tooltip="Create a persistent mapping between this SME row and the selected project for future matching."
                        variant="outline"
                        size="sm"
                        disabled={!selectedProjectKey}
                        onClick={() => selectedProjectKey && persistSmeOverride(row, selectedProjectKey)}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicates">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Duplicate Project Resolutions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Kept Row</TableHead>
                    <TableHead>Discarded Row</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.duplicateProjects.map((row) => (
                    <TableRow key={`${row.kept_row_id}-${row.discarded_row_id}`}>
                      <TableCell>
                        <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                          {row.projectName}
                        </ProjectLink>
                      </TableCell>
                      <TableCell>{row.reportingYear}</TableCell>
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
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course Aliases</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alias</TableHead>
                      <TableHead>Mapped Title</TableHead>
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
                      <TableHead>Mapped Name</TableHead>
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
                    <TableHead>Project</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Project Hours</TableHead>
                    <TableHead>Logged Hours</TableHead>
                    <TableHead>Discrepancy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.discrepancyFlags.map((project) => (
                    <TableRow key={project.projectKey}>
                      <TableCell>
                        <ProjectLink projectName={project.projectName} reportingYear={project.reportingYear}>
                          {project.projectName}
                        </ProjectLink>
                      </TableCell>
                      <TableCell>{project.reportingYear}</TableCell>
                      <TableCell>{project.projectHours}</TableCell>
                      <TableCell>{project.loggedHours}</TableCell>
                      <TableCell>{project.discrepancyHours}</TableCell>
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
