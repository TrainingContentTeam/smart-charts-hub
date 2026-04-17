import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Clock3, Link2, Save, ShieldAlert, Tag, Undo2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionIconButton } from "@/components/ActionIconButton";
import { BulkActionBar } from "@/components/BulkActionBar";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { SearchableProjectSelect } from "@/components/SearchableProjectSelect";
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

function visibleGroupRows(
  group: ReconciliationGroup,
  deferredById: Record<string, boolean>,
  hiddenById: Record<string, boolean>,
) {
  return group.rows.filter((row) => !deferredById[row.raw_time_log_row_id] && !hiddenById[row.raw_time_log_row_id]);
}

function uniqueSelectedRows(
  group: ReconciliationGroup,
  selectedById: Record<string, boolean>,
  deferredById: Record<string, boolean>,
  hiddenById: Record<string, boolean>,
) {
  const visibleRows = visibleGroupRows(group, deferredById, hiddenById);
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
  const [projectTargetByGroupKey, setProjectTargetByGroupKey] = useState<Record<string, string>>({});
  const [timeLogSelection, setTimeLogSelection] = useState<Record<string, boolean>>({});
  const [standaloneSelection, setStandaloneSelection] = useState<Record<string, boolean>>({});
  const [nonProjectSelection, setNonProjectSelection] = useState<Record<string, boolean>>({});
  const [deferredById, setDeferredById] = useState<Record<string, boolean>>({});
  const [hiddenTimeLogRowIds, setHiddenTimeLogRowIds] = useState<Record<string, boolean>>({});
  const [hiddenSmeJoinRowIds, setHiddenSmeJoinRowIds] = useState<Record<string, boolean>>({});
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
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

  const setActionPending = (actionKey: string, value: boolean) => {
    setPendingActions((current) => {
      const next = { ...current };
      if (value) {
        next[actionKey] = true;
      } else {
        delete next[actionKey];
      }
      return next;
    });
  };

  const hideTimeLogRows = (rows: ReconciliationGroupRow[]) => {
    setHiddenTimeLogRowIds((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        next[row.raw_time_log_row_id] = true;
      });
      return next;
    });
  };

  const restoreTimeLogRows = (rows: ReconciliationGroupRow[]) => {
    setHiddenTimeLogRowIds((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        delete next[row.raw_time_log_row_id];
      });
      return next;
    });
  };

  const clearSelections = (rows: ReconciliationGroupRow[]) => {
    const rowIds = new Set(rows.map((row) => row.raw_time_log_row_id));
    const clear = (setter: Dispatch<SetStateAction<Record<string, boolean>>>) =>
      setter((current) => {
        const next = { ...current };
        rowIds.forEach((rowId) => delete next[rowId]);
        return next;
      });

    clear(setTimeLogSelection);
    clear(setStandaloneSelection);
    clear(setNonProjectSelection);
  };

  const persistProjectMatch = async (rows: ReconciliationGroupRow[], targetProjectKey: string) => {
    const targetProject = canonicalProjects.find((project) => project.project_key === targetProjectKey);
    if (!targetProject || !rows.length) return;

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

    const results = await Promise.allSettled(writes);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected && rejected.status === "rejected") {
      throw rejected.reason;
    }
  };

  const persistClassification = async (
    rows: ReconciliationGroupRow[],
    decisionType: "standalone_course" | "non_project_work",
    options?: { standardizedTitle?: string; reportingYear?: string | null },
  ) => {
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

    const results = await Promise.allSettled(writes);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected && rejected.status === "rejected") {
      throw rejected.reason;
    }
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
      return;
    }

    await upsertSharedSmeManualJoin(overrideRow);
  };

  const runTimeLogAction = (
    actionKey: string,
    rows: ReconciliationGroupRow[],
    successMessage: string,
    errorMessage: string,
    callback: () => Promise<void>,
  ) => {
    hideTimeLogRows(rows);
    clearSelections(rows);
    setActionPending(actionKey, true);

    void callback()
      .then(() => {
        toast.success(successMessage);
        invalidate();
      })
      .catch((error) => {
        restoreTimeLogRows(rows);
        toast.error(errorMessage, {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      })
      .finally(() => {
        setActionPending(actionKey, false);
      });
  };

  const runSmeAction = (
    actionKey: string,
    row: ReconciliationSmeJoinRow,
    successMessage: string,
    callback: () => Promise<void>,
  ) => {
    setHiddenSmeJoinRowIds((current) => ({ ...current, [row.raw_sme_feedback_row_id]: true }));
    setActionPending(actionKey, true);

    void callback()
      .then(() => {
        toast.success(successMessage);
        invalidate();
      })
      .catch((error) => {
        setHiddenSmeJoinRowIds((current) => {
          const next = { ...current };
          delete next[row.raw_sme_feedback_row_id];
          return next;
        });
        toast.error("Unable to save the manual SME join.", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      })
      .finally(() => {
        setActionPending(actionKey, false);
      });
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
    hiddenMap: Record<string, boolean>,
  ) => {
    setter((current) => {
      const visibleRows = visibleGroupRows(group, deferredMap, hiddenMap);
      const allSelected = visibleRows.every((row) => current[row.raw_time_log_row_id]);
      const next = { ...current };
      visibleRows.forEach((row) => {
        next[row.raw_time_log_row_id] = !allSelected;
      });
      return next;
    });
  };

  const renderGroupRows = (
    group: ReconciliationGroup,
    selection: Record<string, boolean>,
    setSelection: Dispatch<SetStateAction<Record<string, boolean>>>,
    actionConfig?: {
      allowProjectMatch?: boolean;
      allowStandalone?: boolean;
      allowNonProject?: boolean;
      allowGroupedEdits?: boolean;
    },
  ) => {
    const visibleRows = visibleGroupRows(group, deferredById, hiddenTimeLogRowIds);
    if (!visibleRows.length) return null;

    const selectedRows = uniqueSelectedRows(group, selection, deferredById, hiddenTimeLogRowIds);
    const sharedSuggestionKey = commonSuggestionKey(selectedRows);
    const selectedProjectKey = projectTargetByGroupKey[group.groupKey] || group.topSuggestion?.projectKey || "";
    const deferredCount = group.rows.filter((row) => deferredById[row.raw_time_log_row_id] && !hiddenTimeLogRowIds[row.raw_time_log_row_id]).length;
    const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selection[row.raw_time_log_row_id]);
    const someSelected = visibleRows.some((row) => selection[row.raw_time_log_row_id]);
    const actionKeyPrefix = `${group.groupKey}:${actionConfig?.allowGroupedEdits ? "grouped" : "queue"}`;
    const busy = Object.keys(pendingActions).some((key) => key.startsWith(actionKeyPrefix));
    const editState = standaloneEdits[group.groupKey] || {
      standardizedTitle: group.title,
      reportingYear: group.years[0] || "",
      classification: "standalone_course" as const,
    };

    return (
      <AccordionItem key={group.groupKey} value={group.groupKey}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-4 text-left">
            <span className="font-medium">{group.title}</span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {visibleRows.length} active rows
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {group.totalHours}h
            </span>
            {group.years.map((year) => (
              <span key={year} className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {year}
              </span>
            ))}
            {group.topSuggestion ? (
              <span className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                <span>Suggested: {group.topSuggestion.projectName}</span>
                <ConfidenceBadge confidence={group.topSuggestion.confidence} />
              </span>
            ) : null}
            {deferredCount ? (
              <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                {deferredCount} deferred
              </span>
            ) : null}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              aria-label={`Select group ${group.title}`}
              onCheckedChange={() => toggleGroupSelection(setSelection, group, deferredById, hiddenTimeLogRowIds)}
            />
            <span className="text-sm text-muted-foreground">
              {selectedRows.length} row{selectedRows.length === 1 ? "" : "s"} selected for the next action
            </span>
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

          {actionConfig?.allowGroupedEdits ? (
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
          ) : null}

          <BulkActionBar selectedCount={selectedRows.length}>
            {actionConfig?.allowProjectMatch !== false ? (
              <>
                <SearchableProjectSelect
                  label="Project Override"
                  options={canonicalProjectOptions}
                  selected={selectedProjectKey}
                  onChange={(value) =>
                    setProjectTargetByGroupKey((current) => ({
                      ...current,
                      [group.groupKey]: value,
                    }))
                  }
                />
                <ActionIconButton
                  icon={Link2}
                  label="Accept Suggested Match"
                  tooltip="Use the current suggestion as the persistent project match for the selected rows."
                  variant="default"
                  size="sm"
                  disabled={!sharedSuggestionKey || busy}
                  onClick={() =>
                    sharedSuggestionKey && runTimeLogAction(
                      `${actionKeyPrefix}:suggested`,
                      selectedRows,
                      "Matched to the suggested project.",
                      "Unable to match these rows to the suggested project.",
                      () => persistProjectMatch(selectedRows, sharedSuggestionKey),
                    )
                  }
                />
                <ActionIconButton
                  icon={Save}
                  label="Save Project Match"
                  tooltip="Override the suggestion and map the selected rows to the project you picked."
                  variant="outline"
                  size="sm"
                  disabled={!selectedProjectKey || busy}
                  onClick={() =>
                    selectedProjectKey && runTimeLogAction(
                      `${actionKeyPrefix}:manual`,
                      selectedRows,
                      "Matched to the selected project.",
                      "Unable to save the manual project match.",
                      () => persistProjectMatch(selectedRows, selectedProjectKey),
                    )
                  }
                />
              </>
            ) : null}
            {actionConfig?.allowStandalone !== false ? (
              <ActionIconButton
                icon={Tag}
                label="Standalone (Single Video / Other)"
                tooltip="Mark these rows as course-like work that is not present in project exports."
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  runTimeLogAction(
                    `${actionKeyPrefix}:standalone`,
                    selectedRows,
                    "Marked as Standalone (Single Video / Other).",
                    "Unable to mark these rows as standalone work.",
                    () =>
                      persistClassification(selectedRows, "standalone_course", actionConfig?.allowGroupedEdits
                        ? {
                            standardizedTitle: editState.standardizedTitle,
                            reportingYear: editState.reportingYear || null,
                          }
                        : undefined),
                  )
                }
              />
            ) : null}
            {actionConfig?.allowNonProject !== false ? (
              <ActionIconButton
                icon={ShieldAlert}
                label="Non-Project"
                tooltip="Mark these rows as operational or support work that should not map to a course project."
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  runTimeLogAction(
                    `${actionKeyPrefix}:non-project`,
                    selectedRows,
                    "Marked as non-project work.",
                    "Unable to mark these rows as non-project work.",
                    () =>
                      persistClassification(selectedRows, "non_project_work", actionConfig?.allowGroupedEdits
                        ? {
                            standardizedTitle: editState.standardizedTitle,
                            reportingYear: editState.reportingYear || null,
                          }
                        : undefined),
                  )
                }
              />
            ) : null}
            <ActionIconButton
              icon={Clock3}
              label="Defer"
              tooltip="Hide the selected rows for this session without saving a persistent decision."
              variant="ghost"
              size="sm"
              disabled={busy}
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
                  <TableCell>
                    {row.roleGroup === "ID" || row.roleGroup === "SME" ? (
                      <PersonLink personName={row.user}>{row.user}</PersonLink>
                    ) : row.user}
                  </TableCell>
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
        </AccordionContent>
      </AccordionItem>
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

  const timeLogGroups = model.timeLogGroups.filter((group) => visibleGroupRows(group, deferredById, hiddenTimeLogRowIds).length > 0);
  const standaloneGroups = model.standaloneGroups.filter((group) => visibleGroupRows(group, deferredById, hiddenTimeLogRowIds).length > 0);
  const nonProjectGroups = model.nonProjectGroups.filter((group) => visibleGroupRows(group, deferredById, hiddenTimeLogRowIds).length > 0);
  const visibleSmeJoinRows = model.smeJoinRows.filter((row) => !hiddenSmeJoinRowIds[row.raw_sme_feedback_row_id]);

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
          {timeLogGroups.length ? (
            <Accordion type="multiple" className="rounded-lg border px-4">
              {timeLogGroups.map((group) => renderGroupRows(group, timeLogSelection, setTimeLogSelection))}
            </Accordion>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No reconcilable time-log groups are left in the active queue.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="standalone" className="space-y-4">
          {standaloneGroups.length ? (
            <Accordion type="multiple" className="rounded-lg border px-4">
              {standaloneGroups.map((group) =>
                renderGroupRows(group, standaloneSelection, setStandaloneSelection, {
                  allowGroupedEdits: true,
                }),
              )}
            </Accordion>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No standalone candidates are left in the active queue.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="non-project" className="space-y-4">
          {nonProjectGroups.length ? (
            <Accordion type="multiple" className="rounded-lg border px-4">
              {nonProjectGroups.map((group) =>
                renderGroupRows(group, nonProjectSelection, setNonProjectSelection),
              )}
            </Accordion>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No non-project candidates are left in the active queue.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sme">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Unresolved and Ambiguous SME Joins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleSmeJoinRows.map((row) => {
                const selectedProjectKey = surveyTargetByRowId[row.raw_sme_feedback_row_id] || row.suggestedProject?.projectKey || "";
                const actionKey = `sme:${row.raw_sme_feedback_row_id}`;
                const busy = Boolean(pendingActions[actionKey]);

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

                      <SearchableProjectSelect
                        label="Project Override"
                        options={canonicalProjectOptions}
                        selected={selectedProjectKey}
                        onChange={(value) =>
                          setSurveyTargetByRowId((current) => ({
                            ...current,
                            [row.raw_sme_feedback_row_id]: value,
                          }))
                        }
                      />

                      {row.suggestedProject ? (
                        <ActionIconButton
                          icon={Link2}
                          label="Accept Suggested Match"
                          tooltip="Use the suggested project for this survey row."
                          variant="default"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            runSmeAction(
                              actionKey,
                              row,
                              "Manual SME join saved with the suggested project.",
                              () => persistSmeOverride(row, row.suggestedProject!.projectKey),
                            )
                          }
                        />
                      ) : null}
                      <ActionIconButton
                        icon={Save}
                        label="Save Persistent Match"
                        tooltip="Create a persistent mapping between this SME row and the selected project for future matching."
                        variant="outline"
                        size="sm"
                        disabled={!selectedProjectKey || busy}
                        onClick={() =>
                          selectedProjectKey && runSmeAction(
                            actionKey,
                            row,
                            "Manual SME join saved.",
                            () => persistSmeOverride(row, selectedProjectKey),
                          )
                        }
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
