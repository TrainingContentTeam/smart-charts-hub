import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { selectProjectsPageRows } from "@/lib/analytics/selectors";

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export default function Projects() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const rows = useMemo(() => (snapshot ? selectProjectsPageRows(snapshot) : []), [snapshot]);

  const [search, setSearch] = useState("");
  const [reportingYear, setReportingYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [sme, setSme] = useState("all");
  const [legalReviewer, setLegalReviewer] = useState("all");
  const [vertical, setVertical] = useState("all");
  const [courseType, setCourseType] = useState("all");
  const [authoringTool, setAuthoringTool] = useState("all");
  const [discrepancyFlag, setDiscrepancyFlag] = useState("all");
  const [hasTimeLogs, setHasTimeLogs] = useState("all");
  const [hasSmeFeedback, setHasSmeFeedback] = useState("all");

  const filterOptions = useMemo(() => ({
    reportingYear: uniqueSorted(rows.map((row) => row.reportingYear)),
    status: uniqueSorted(rows.map((row) => row.status)),
    owner: uniqueSorted(rows.map((row) => row.idAssignedRaw)),
    sme: uniqueSorted(rows.map((row) => row.smeAssignedRaw)),
    legalReviewer: uniqueSorted(rows.map((row) => row.legalReviewerRaw)),
    vertical: uniqueSorted(rows.map((row) => row.primaryVertical)),
    courseType: uniqueSorted(rows.map((row) => row.courseType)),
    authoringTool: uniqueSorted(rows.map((row) => row.authoringTool)),
  }), [rows]);

  const filteredRows = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (searchText && !`${row.projectKey} ${row.rawCourseName}`.toLowerCase().includes(searchText)) return false;
      if (reportingYear !== "all" && row.reportingYear !== reportingYear) return false;
      if (status !== "all" && row.status !== status) return false;
      if (owner !== "all" && row.idAssignedRaw !== owner) return false;
      if (sme !== "all" && row.smeAssignedRaw !== sme) return false;
      if (legalReviewer !== "all" && row.legalReviewerRaw !== legalReviewer) return false;
      if (vertical !== "all" && row.primaryVertical !== vertical) return false;
      if (courseType !== "all" && row.courseType !== courseType) return false;
      if (authoringTool !== "all" && row.authoringTool !== authoringTool) return false;
      if (discrepancyFlag === "yes" && !row.hoursDiscrepancyFlag) return false;
      if (discrepancyFlag === "no" && row.hoursDiscrepancyFlag) return false;
      if (hasTimeLogs === "yes" && !row.hasTimeLogs) return false;
      if (hasTimeLogs === "no" && row.hasTimeLogs) return false;
      if (hasSmeFeedback === "yes" && !row.hasSmeFeedback) return false;
      if (hasSmeFeedback === "no" && row.hasSmeFeedback) return false;
      return true;
    });
  }, [
    authoringTool,
    courseType,
    discrepancyFlag,
    hasSmeFeedback,
    hasTimeLogs,
    legalReviewer,
    owner,
    reportingYear,
    rows,
    search,
    sme,
    status,
    vertical,
  ]);

  const SelectRow = ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
  }) => (
    <label className="space-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );

  if (isLoading) {
    return <div className="text-muted-foreground">Loading canonical project table...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">
          One row per canonical project key, with project totals, matched time-log totals, discrepancy flags, and unresolved SME counts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search by project key or course name" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <SelectRow label="Reporting Year" value={reportingYear} onChange={setReportingYear} options={filterOptions.reportingYear} />
            <SelectRow label="Status" value={status} onChange={setStatus} options={filterOptions.status} />
            <SelectRow label="Owner" value={owner} onChange={setOwner} options={filterOptions.owner} />
            <SelectRow label="SME" value={sme} onChange={setSme} options={filterOptions.sme} />
            <SelectRow label="Legal Reviewer" value={legalReviewer} onChange={setLegalReviewer} options={filterOptions.legalReviewer} />
            <SelectRow label="Vertical" value={vertical} onChange={setVertical} options={filterOptions.vertical} />
            <SelectRow label="Course Type" value={courseType} onChange={setCourseType} options={filterOptions.courseType} />
            <SelectRow label="Authoring Tool" value={authoringTool} onChange={setAuthoringTool} options={filterOptions.authoringTool} />
            <SelectRow label="Discrepancy Flag" value={discrepancyFlag} onChange={setDiscrepancyFlag} options={["yes", "no"]} />
            <SelectRow label="Has Time Logs" value={hasTimeLogs} onChange={setHasTimeLogs} options={["yes", "no"]} />
            <SelectRow label="Has SME Feedback" value={hasSmeFeedback} onChange={setHasSmeFeedback} options={["yes", "no"]} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{filteredRows.length} Canonical Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Key</TableHead>
                  <TableHead>Course Name</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Project Hours</TableHead>
                  <TableHead>Time Log Hours</TableHead>
                  <TableHead>Discrepancy</TableHead>
                  <TableHead>ID Assigned</TableHead>
                  <TableHead>SME</TableHead>
                  <TableHead>Legal</TableHead>
                  <TableHead>Primary Vertical</TableHead>
                  <TableHead>All Verticals</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Interactions</TableHead>
                  <TableHead>Latest Log</TableHead>
                  <TableHead>Unresolved SME Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.projectKey}>
                    <TableCell>{row.projectKey}</TableCell>
                    <TableCell>{row.rawCourseName}</TableCell>
                    <TableCell>{row.reportingYear}</TableCell>
                    <TableCell>{row.sourceDataset}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.projectTotalHours}</TableCell>
                    <TableCell>{row.timeLogHours}</TableCell>
                    <TableCell>{row.hoursDiscrepancyFlag ? "Flagged" : "OK"}</TableCell>
                    <TableCell>{row.idAssignedRaw}</TableCell>
                    <TableCell>{row.smeAssignedRaw}</TableCell>
                    <TableCell>{row.legalReviewerRaw}</TableCell>
                    <TableCell>{row.primaryVertical}</TableCell>
                    <TableCell>{row.fullVerticalList}</TableCell>
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
