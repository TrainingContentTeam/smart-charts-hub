import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { ChartDateRangeFilter } from "@/components/ChartFilters";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { EXTERNAL_WORK_CLASSIFICATION_LABELS, WORK_SCOPE_LABELS } from "@/lib/analytics/labels";
import { selectProjectsPageRows } from "@/lib/analytics/selectors";

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function toOptions(values: string[]): CompactFilterOption[] {
  return uniqueSorted(values).map((value) => ({ label: value, value }));
}

function matchesBooleanFilter(selected: string[], value: boolean) {
  if (!selected.length || selected.length === 2) return true;
  return selected.includes(value ? "yes" : "no");
}

function hasDateInRange(values: string[], startDate: string, endDate: string) {
  if (!startDate && !endDate) return true;
  return values.some((value) => {
    if (!value) return false;
    if (startDate && value < startDate) return false;
    if (endDate && value > endDate) return false;
    return true;
  });
}

export default function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const rows = useMemo(() => (snapshot ? selectProjectsPageRows(snapshot) : []), [snapshot]);

  const search = searchParams.get("q") || "";
  const reportingYears = searchParams.getAll("year");
  const statuses = searchParams.getAll("status");
  const owners = searchParams.getAll("owner");
  const smes = searchParams.getAll("sme");
  const legalReviewers = searchParams.getAll("legal");
  const verticals = searchParams.getAll("vertical");
  const courseTypes = searchParams.getAll("type");
  const authoringTools = searchParams.getAll("tool");
  const exactProjects = searchParams.getAll("project");
  const courseStyles = searchParams.getAll("style");
  const courseLengths = searchParams.getAll("length");
  const activeFilters = searchParams.getAll("active");
  const timePhases = searchParams.getAll("timePhase");
  const timeRoles = searchParams.getAll("timeRole");
  const timeUsers = searchParams.getAll("timeUser");
  const workScopes = searchParams.getAll("workScope");
  const externalClasses = searchParams.getAll("externalClass");
  const timeStart = searchParams.get("timeStart") || "";
  const timeEnd = searchParams.get("timeEnd") || "";
  const smeIds = searchParams.getAll("smeId");
  const smeInternal = searchParams.getAll("smeInternal");
  const smeStart = searchParams.get("smeStart") || "";
  const smeEnd = searchParams.get("smeEnd") || "";
  const discrepancyFilters = searchParams.getAll("discrepancy");
  const hasTimeLogFilters = searchParams.getAll("timeLogs");
  const hasSmeFilters = searchParams.getAll("smeFeedback");

  const setMultiParam = (key: string, values: string[]) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    values.forEach((value) => next.append(key, value));
    setSearchParams(next, { replace: true });
  };

  const setSearchValue = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set("q", value);
    } else {
      next.delete("q");
    }
    setSearchParams(next, { replace: true });
  };

  const setSingleParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const filterOptions = useMemo(() => ({
    exactProject: toOptions(rows.flatMap((row) => row.exactProjectValues)),
    reportingYear: toOptions(rows.map((row) => row.reportingYear)),
    status: toOptions(rows.map((row) => row.status)),
    owner: toOptions(rows.flatMap((row) => row.ownerNames.length ? row.ownerNames : [row.idAssignedRaw || "Unassigned"])),
    sme: toOptions(rows.map((row) => row.smeAssignedRaw || "Unassigned")),
    legalReviewer: toOptions(rows.map((row) => row.legalReviewerRaw || "Unassigned")),
    vertical: toOptions(rows.flatMap((row) => row.verticals.length ? row.verticals : [row.primaryVertical])),
    courseType: toOptions(rows.map((row) => row.courseType)),
    authoringTool: toOptions(rows.map((row) => row.authoringTool)),
    courseStyle: toOptions(rows.map((row) => row.courseStyle)),
    courseLength: toOptions(rows.map((row) => row.courseLengthRaw)),
    timePhase: toOptions(rows.flatMap((row) => row.timeLogPhases)),
    timeRole: toOptions(rows.flatMap((row) => row.timeLogRoleGroups)),
    timeUser: toOptions(rows.flatMap((row) => row.timeLogUsers)),
    workScope: Object.entries(WORK_SCOPE_LABELS).map(([value, label]) => ({ value, label })),
    externalClass: Object.entries(EXTERNAL_WORK_CLASSIFICATION_LABELS).map(([value, label]) => ({ value, label })),
    smeId: toOptions(rows.flatMap((row) => row.smeFeedbackInstructionalDesigners)),
    smeInternal: toOptions(rows.flatMap((row) => row.smeFeedbackInternalLabels)),
    yesNo: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  }), [rows]);

  const filteredRows = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return rows.filter((row) => {
      const searchableText = [
        row.projectName,
        row.projectKey,
        row.status,
        row.idAssignedRaw,
        row.smeAssignedRaw,
        row.legalReviewerRaw,
        row.fullVerticalList,
        row.courseType,
        row.authoringTool,
        row.courseStyle,
        row.courseLengthRaw,
      ]
        .join(" ")
        .toLowerCase();

      if (searchText && !searchableText.includes(searchText)) return false;
      if (reportingYears.length && !reportingYears.includes(row.reportingYear)) return false;
      if (statuses.length && !statuses.includes(row.status)) return false;
      if (owners.length && !row.ownerNames.some((owner) => owners.includes(owner))) return false;
      if (smes.length && !smes.includes(row.smeAssignedRaw || "Unassigned")) return false;
      if (legalReviewers.length && !legalReviewers.includes(row.legalReviewerRaw || "Unassigned")) return false;
      if (verticals.length && !row.verticals.some((vertical) => verticals.includes(vertical))) return false;
      if (courseTypes.length && !courseTypes.includes(row.courseType)) return false;
      if (authoringTools.length && !authoringTools.includes(row.authoringTool)) return false;
      if (exactProjects.length && !row.exactProjectValues.some((project) => exactProjects.includes(project))) return false;
      if (courseStyles.length && !courseStyles.includes(row.courseStyle)) return false;
      if (courseLengths.length && !courseLengths.includes(row.courseLengthRaw)) return false;
      if (!matchesBooleanFilter(activeFilters, row.isActive)) return false;
      if (timePhases.length && !row.timeLogPhases.some((phase) => timePhases.includes(phase))) return false;
      if (timeRoles.length && !row.timeLogRoleGroups.some((role) => timeRoles.includes(role))) return false;
      if (timeUsers.length && !row.timeLogUsers.some((user) => timeUsers.includes(user))) return false;
      if (workScopes.length && !row.timeLogWorkScopes.some((scope) => workScopes.includes(scope))) return false;
      if (externalClasses.length && !row.timeLogExternalClassifications.some((classification) => externalClasses.includes(classification))) return false;
      if (!hasDateInRange(row.timeLogDates, timeStart, timeEnd)) return false;
      if (smeIds.length && !row.smeFeedbackInstructionalDesigners.some((id) => smeIds.includes(id))) return false;
      if (smeInternal.length && !row.smeFeedbackInternalLabels.some((value) => smeInternal.includes(value))) return false;
      if (!hasDateInRange(row.smeFeedbackDates, smeStart, smeEnd)) return false;
      if (!matchesBooleanFilter(discrepancyFilters, row.hoursDiscrepancyFlag)) return false;
      if (!matchesBooleanFilter(hasTimeLogFilters, row.hasTimeLogs)) return false;
      if (!matchesBooleanFilter(hasSmeFilters, row.hasSmeFeedback)) return false;
      return true;
    });
  }, [
    authoringTools,
    courseLengths,
    courseStyles,
    courseTypes,
    activeFilters,
    discrepancyFilters,
    exactProjects,
    externalClasses,
    hasSmeFilters,
    hasTimeLogFilters,
    legalReviewers,
    owners,
    reportingYears,
    rows,
    search,
    smes,
    smeEnd,
    statuses,
    smeIds,
    smeInternal,
    smeStart,
    timeEnd,
    timePhases,
    timeRoles,
    timeStart,
    timeUsers,
    verticals,
    workScopes,
  ]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading project records...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          One row per project record, with project totals, logged totals, discrepancy visibility, and SME coverage kept distinct.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by project name, owner, SME, reviewer, vertical, type, or tool"
            value={search}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <CompactMultiSelectFilter label="Project" options={filterOptions.exactProject} selected={exactProjects} onChange={(values) => setMultiParam("project", values)} />
            <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.reportingYear} selected={reportingYears} onChange={(values) => setMultiParam("year", values)} />
            <CompactMultiSelectFilter label="Status" options={filterOptions.status} selected={statuses} onChange={(values) => setMultiParam("status", values)} />
            <CompactMultiSelectFilter label="Owner" options={filterOptions.owner} selected={owners} onChange={(values) => setMultiParam("owner", values)} />
            <CompactMultiSelectFilter label="SME" options={filterOptions.sme} selected={smes} onChange={(values) => setMultiParam("sme", values)} />
            <CompactMultiSelectFilter label="Legal Reviewer" options={filterOptions.legalReviewer} selected={legalReviewers} onChange={(values) => setMultiParam("legal", values)} />
            <CompactMultiSelectFilter label="Vertical" options={filterOptions.vertical} selected={verticals} onChange={(values) => setMultiParam("vertical", values)} />
            <CompactMultiSelectFilter label="Course Type" options={filterOptions.courseType} selected={courseTypes} onChange={(values) => setMultiParam("type", values)} />
            <CompactMultiSelectFilter label="Authoring Tool" options={filterOptions.authoringTool} selected={authoringTools} onChange={(values) => setMultiParam("tool", values)} />
            <CompactMultiSelectFilter label="Style" options={filterOptions.courseStyle} selected={courseStyles} onChange={(values) => setMultiParam("style", values)} />
            <CompactMultiSelectFilter label="Length" options={filterOptions.courseLength} selected={courseLengths} onChange={(values) => setMultiParam("length", values)} />
            <CompactMultiSelectFilter label="Active" options={filterOptions.yesNo} selected={activeFilters} onChange={(values) => setMultiParam("active", values)} />
            <CompactMultiSelectFilter label="Time Log Phase" options={filterOptions.timePhase} selected={timePhases} onChange={(values) => setMultiParam("timePhase", values)} />
            <CompactMultiSelectFilter label="Time Log Role Group" options={filterOptions.timeRole} selected={timeRoles} onChange={(values) => setMultiParam("timeRole", values)} />
            <CompactMultiSelectFilter label="Time Log User" options={filterOptions.timeUser} selected={timeUsers} onChange={(values) => setMultiParam("timeUser", values)} />
            <CompactMultiSelectFilter label="Work Scope" options={filterOptions.workScope} selected={workScopes} onChange={(values) => setMultiParam("workScope", values)} />
            <CompactMultiSelectFilter label="External Class" options={filterOptions.externalClass} selected={externalClasses} onChange={(values) => setMultiParam("externalClass", values)} />
            <CompactMultiSelectFilter label="SME ID" options={filterOptions.smeId} selected={smeIds} onChange={(values) => setMultiParam("smeId", values)} />
            <CompactMultiSelectFilter label="SME Internal" options={filterOptions.smeInternal} selected={smeInternal} onChange={(values) => setMultiParam("smeInternal", values)} />
            <CompactMultiSelectFilter label="Discrepancy" options={filterOptions.yesNo} selected={discrepancyFilters} onChange={(values) => setMultiParam("discrepancy", values)} />
            <CompactMultiSelectFilter label="Has Time Logs" options={filterOptions.yesNo} selected={hasTimeLogFilters} onChange={(values) => setMultiParam("timeLogs", values)} />
            <CompactMultiSelectFilter label="Has SME Feedback" options={filterOptions.yesNo} selected={hasSmeFilters} onChange={(values) => setMultiParam("smeFeedback", values)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ChartDateRangeFilter
              label="Time Log Dates"
              startDate={timeStart}
              endDate={timeEnd}
              onStartDateChange={(value) => setSingleParam("timeStart", value)}
              onEndDateChange={(value) => setSingleParam("timeEnd", value)}
            />
            <ChartDateRangeFilter
              label="SME Dates"
              startDate={smeStart}
              endDate={smeEnd}
              onStartDateChange={(value) => setSingleParam("smeStart", value)}
              onEndDateChange={(value) => setSingleParam("smeEnd", value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filteredRows.length} Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Project Hours</TableHead>
                  <TableHead>Logged Hours</TableHead>
                  <TableHead>Discrepancy</TableHead>
                  <TableHead>Owners</TableHead>
                  <TableHead>SME</TableHead>
                  <TableHead>Legal</TableHead>
                  <TableHead>Verticals</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Interactions</TableHead>
                  <TableHead>Latest Log</TableHead>
                  <TableHead>SME Rows Needing Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow
                    key={row.projectKey}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("a,button,input,[role='button']")) return;

                      navigate(row.projectHref, {
                        state: { from: `${location.pathname}${location.search}` },
                      });
                    }}
                  >
                    <TableCell className="min-w-[240px]">
                      <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                        {row.projectName}
                      </ProjectLink>
                    </TableCell>
                    <TableCell>{row.reportingYear}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.projectTotalHours}</TableCell>
                    <TableCell>{row.timeLogHours}</TableCell>
                    <TableCell>{row.hoursDiscrepancyFlag ? "Flagged" : "OK"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {(row.ownerNames.length ? row.ownerNames : [row.idAssignedRaw || "Unassigned"])
                          .filter(Boolean)
                          .map((owner) => owner === "Unassigned" ? (
                            <span key={owner}>{owner}</span>
                          ) : (
                            <PersonLink key={owner} personName={owner}>{owner}</PersonLink>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {(row.smeAssignedRaw ? row.smeAssignedRaw.split(",").map((name) => name.trim()).filter(Boolean) : [])
                          .map((sme) => (
                            <PersonLink key={sme} personName={sme}>{sme}</PersonLink>
                          ))}
                        {!row.smeAssignedRaw ? <span>-</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>{row.legalReviewerRaw || "-"}</TableCell>
                    <TableCell>{row.fullVerticalList || "-"}</TableCell>
                    <TableCell>{row.courseType}</TableCell>
                    <TableCell>{row.authoringTool}</TableCell>
                    <TableCell>{row.courseStyle}</TableCell>
                    <TableCell>{row.courseLengthRaw}</TableCell>
                    <TableCell>{row.interactionCount ?? "-"}</TableCell>
                    <TableCell>{row.latestTimeLogDate || "-"}</TableCell>
                    <TableCell>{row.unresolvedSmeFeedbackCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
