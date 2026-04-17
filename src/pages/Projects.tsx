import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
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

  const filterOptions = useMemo(() => ({
    reportingYear: toOptions(rows.map((row) => row.reportingYear)),
    status: toOptions(rows.map((row) => row.status)),
    owner: toOptions(rows.flatMap((row) => row.ownerNames.length ? row.ownerNames : [row.idAssignedRaw || "Unassigned"])),
    sme: toOptions(rows.map((row) => row.smeAssignedRaw || "Unassigned")),
    legalReviewer: toOptions(rows.map((row) => row.legalReviewerRaw || "Unassigned")),
    vertical: toOptions(rows.flatMap((row) => row.verticals.length ? row.verticals : [row.primaryVertical])),
    courseType: toOptions(rows.map((row) => row.courseType)),
    authoringTool: toOptions(rows.map((row) => row.authoringTool)),
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
        row.status,
        row.idAssignedRaw,
        row.smeAssignedRaw,
        row.legalReviewerRaw,
        row.fullVerticalList,
        row.courseType,
        row.authoringTool,
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
      if (!matchesBooleanFilter(discrepancyFilters, row.hoursDiscrepancyFlag)) return false;
      if (!matchesBooleanFilter(hasTimeLogFilters, row.hasTimeLogs)) return false;
      if (!matchesBooleanFilter(hasSmeFilters, row.hasSmeFeedback)) return false;
      return true;
    });
  }, [
    authoringTools,
    courseTypes,
    discrepancyFilters,
    hasSmeFilters,
    hasTimeLogFilters,
    legalReviewers,
    owners,
    reportingYears,
    rows,
    search,
    smes,
    statuses,
    verticals,
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
            <CompactMultiSelectFilter label="Reporting Year" options={filterOptions.reportingYear} selected={reportingYears} onChange={(values) => setMultiParam("year", values)} />
            <CompactMultiSelectFilter label="Status" options={filterOptions.status} selected={statuses} onChange={(values) => setMultiParam("status", values)} />
            <CompactMultiSelectFilter label="Owner" options={filterOptions.owner} selected={owners} onChange={(values) => setMultiParam("owner", values)} />
            <CompactMultiSelectFilter label="SME" options={filterOptions.sme} selected={smes} onChange={(values) => setMultiParam("sme", values)} />
            <CompactMultiSelectFilter label="Legal Reviewer" options={filterOptions.legalReviewer} selected={legalReviewers} onChange={(values) => setMultiParam("legal", values)} />
            <CompactMultiSelectFilter label="Vertical" options={filterOptions.vertical} selected={verticals} onChange={(values) => setMultiParam("vertical", values)} />
            <CompactMultiSelectFilter label="Course Type" options={filterOptions.courseType} selected={courseTypes} onChange={(values) => setMultiParam("type", values)} />
            <CompactMultiSelectFilter label="Authoring Tool" options={filterOptions.authoringTool} selected={authoringTools} onChange={(values) => setMultiParam("tool", values)} />
            <CompactMultiSelectFilter label="Discrepancy" options={filterOptions.yesNo} selected={discrepancyFilters} onChange={(values) => setMultiParam("discrepancy", values)} />
            <CompactMultiSelectFilter label="Has Time Logs" options={filterOptions.yesNo} selected={hasTimeLogFilters} onChange={(values) => setMultiParam("timeLogs", values)} />
            <CompactMultiSelectFilter label="Has SME Feedback" options={filterOptions.yesNo} selected={hasSmeFilters} onChange={(values) => setMultiParam("smeFeedback", values)} />
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
                    onClick={() =>
                      navigate(row.projectHref, {
                        state: { from: `${location.pathname}${location.search}` },
                      })
                    }
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
                    <TableCell>{row.ownerNames.join(", ") || row.idAssignedRaw || "Unassigned"}</TableCell>
                    <TableCell>{row.smeAssignedRaw || "-"}</TableCell>
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
