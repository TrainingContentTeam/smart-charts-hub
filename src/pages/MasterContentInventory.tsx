import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarYears, parseISO } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLmsCourseInfo, useLmsCourseVersions } from "@/hooks/use-time-data";
import { LibraryBig, Layers3, Search, ChevronDown, Upload, CalendarRange, Filter, ExternalLink } from "lucide-react";

function text(value: unknown): string {
  return String(value || "").trim();
}

function formatDate(value: unknown): string {
  return text(value) || "—";
}

function OpenLinkButton({ href, label }: { href: unknown; label: string }) {
  const url = text(href);
  if (!url) return <span>—</span>;

  return (
    <Button asChild variant="outline" size="sm" className="h-8">
      <a href={url} target="_blank" rel="noreferrer noopener">
        {label}
        <ExternalLink className="ml-2 h-3.5 w-3.5" />
      </a>
    </Button>
  );
}

function normalizeToken(value: unknown): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isTruthyFlag(value: unknown, expectedLabel?: string): boolean {
  const normalized = text(value).toLowerCase();
  if (["true", "yes", "y", "1", "x"].includes(normalized)) return true;
  if (expectedLabel) return normalizeToken(value) === normalizeToken(expectedLabel);
  return false;
}

function safeParseDate(value: string | null): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

type AgeBucket = "0-2" | "3-5" | "6+" | "unknown";
type VerticalMode = "latest" | "historical";
type AgeChartMode = "dated_only" | "include_unknown";

type CatalogCourse = {
  courseId: string;
  info: any | null;
  versions: any[];
  latestVersion: any | null;
  effectiveDate: string | null;
  ageBucket: AgeBucket;
  applicableVerticals: string[];
  historicalVerticals: string[];
  hasMultipleVersions: boolean;
  contentType: string;
  authoringTool: string;
  courseName: string;
};

type InventoryFilters = {
  vertical: string;
  contentType: string;
  authoringTool: string;
  ageGroup: AgeBucket | "all";
  multipleVersions: "all" | "yes" | "no";
};

const DEFAULT_FILTERS: InventoryFilters = {
  vertical: "all",
  contentType: "all",
  authoringTool: "all",
  ageGroup: "all",
  multipleVersions: "all",
};

const VERTICAL_FIELDS = [
  { key: "ems1a", label: "EMS1A" },
  { key: "p1a", label: "P1A" },
  { key: "fr1a", label: "FR1A" },
  { key: "c1a", label: "C1A" },
  { key: "lgu", label: "LGU" },
  { key: "d1a", label: "D1A" },
];

function getApplicableVerticals(version: any): string[] {
  if (!version) return [];
  return VERTICAL_FIELDS.filter((field) => isTruthyFlag(version[field.key], field.label)).map((field) => field.label);
}

function toAgeBucket(dateValue: string | null): AgeBucket {
  const parsed = safeParseDate(dateValue);
  if (!parsed) return "unknown";
  const age = Math.max(0, differenceInCalendarYears(new Date(), parsed));
  if (age <= 2) return "0-2";
  if (age <= 5) return "3-5";
  return "6+";
}

function bucketLabel(value: AgeBucket | "all") {
  switch (value) {
    case "0-2": return "0-2 years";
    case "3-5": return "3-5 years";
    case "6+": return "6+ years";
    case "unknown": return "Unknown";
    default: return "All";
  }
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder={`All ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function MasterContentInventory() {
  const { data: infoRows = [] } = useLmsCourseInfo();
  const { data: versionRows = [] } = useLmsCourseVersions();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [verticalMode, setVerticalMode] = useState<VerticalMode>("latest");
  const [ageChartMode, setAgeChartMode] = useState<AgeChartMode>("include_unknown");
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);

  const combinedCourses = useMemo(() => {
    const byCourseId = new Map<string, CatalogCourse>();

    infoRows.forEach((row: any) => {
      byCourseId.set(row.course_id, {
        courseId: row.course_id,
        info: row,
        versions: byCourseId.get(row.course_id)?.versions || [],
        latestVersion: null,
        effectiveDate: null,
        ageBucket: "unknown",
        applicableVerticals: [],
        historicalVerticals: [],
        hasMultipleVersions: false,
        contentType: text(row.course_type),
        authoringTool: "",
        courseName: row.course_id,
      });
    });

    versionRows.forEach((row: any) => {
      const existing = byCourseId.get(row.course_id) || {
        courseId: row.course_id,
        info: null,
        versions: [],
        latestVersion: null,
        effectiveDate: null,
        ageBucket: "unknown" as AgeBucket,
        applicableVerticals: [],
        historicalVerticals: [],
        hasMultipleVersions: false,
        contentType: "",
        authoringTool: "",
        courseName: row.course_id,
      };
      existing.versions.push(row);
      byCourseId.set(row.course_id, existing);
    });

    const courses = [...byCourseId.values()].map((course) => {
      const sortedVersions = [...course.versions].sort((a, b) =>
        text(b.published_date).localeCompare(text(a.published_date)) ||
        text(b.course_version).localeCompare(text(a.course_version)),
      );
      const latestVersion = sortedVersions[0] || null;
      const historicalVerticals = [...new Set(sortedVersions.flatMap((version) => getApplicableVerticals(version)))];
      const effectiveDate = text(latestVersion?.published_date) || text(course.info?.original_publish_date) || null;

      return {
        ...course,
        versions: sortedVersions,
        latestVersion,
        effectiveDate,
        ageBucket: toAgeBucket(effectiveDate),
        applicableVerticals: getApplicableVerticals(latestVersion),
        historicalVerticals,
        hasMultipleVersions: sortedVersions.length > 1,
        contentType: text(course.info?.course_type),
        authoringTool: text(latestVersion?.authoring_tool),
        courseName: text(latestVersion?.course_name) || course.courseId,
      };
    });

    courses.sort((a, b) => a.courseName.localeCompare(b.courseName) || a.courseId.localeCompare(b.courseId));
    return courses;
  }, [infoRows, versionRows]);

  const filterOptions = useMemo(() => {
    const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      verticals: uniqueSorted(combinedCourses.flatMap((course) => course.historicalVerticals)).map((value) => ({ value, label: value })),
      contentTypes: uniqueSorted(combinedCourses.map((course) => course.contentType)).map((value) => ({ value, label: value })),
      authoringTools: uniqueSorted(combinedCourses.map((course) => course.authoringTool)).map((value) => ({ value, label: value })),
      ageGroups: ["0-2", "3-5", "6+", "unknown"].map((value) => ({ value, label: bucketLabel(value as AgeBucket) })),
    };
  }, [combinedCourses]);

  const browserFilteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return combinedCourses.filter((course) => {
      if (filters.vertical !== "all" && !course.historicalVerticals.includes(filters.vertical)) return false;
      if (filters.contentType !== "all" && course.contentType !== filters.contentType) return false;
      if (filters.authoringTool !== "all" && course.authoringTool !== filters.authoringTool) return false;
      if (filters.ageGroup !== "all" && course.ageBucket !== filters.ageGroup) return false;
      if (filters.multipleVersions === "yes" && !course.hasMultipleVersions) return false;
      if (filters.multipleVersions === "no" && course.hasMultipleVersions) return false;

      if (!query) return true;
      const haystack = [
        course.courseId,
        course.courseName,
        course.contentType,
        course.authoringTool,
        course.info?.backend_url,
        course.info?.frontend_url,
        ...course.historicalVerticals,
        ...course.versions.map((version) => version.course_version),
        ...course.versions.map((version) => version.lesson_plan),
        ...course.versions.map((version) => version.special),
      ]
        .map((value) => text(value).toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [combinedCourses, search, filters]);

  const verticalStats = useMemo(() => {
    const source = verticalMode === "latest" ? "applicableVerticals" : "historicalVerticals";
    return VERTICAL_FIELDS.map((field) => ({
      label: field.label,
      count: combinedCourses.filter((course) => course[source].includes(field.label)).length,
    }));
  }, [combinedCourses, verticalMode]);

  const ageChartData = useMemo(() => {
    const rows = [
      { bucket: "0-2 years", rawBucket: "0-2", count: combinedCourses.filter((course) => course.ageBucket === "0-2").length },
      { bucket: "3-5 years", rawBucket: "3-5", count: combinedCourses.filter((course) => course.ageBucket === "3-5").length },
      { bucket: "6+ years", rawBucket: "6+", count: combinedCourses.filter((course) => course.ageBucket === "6+").length },
    ];
    return ageChartMode === "include_unknown"
      ? [...rows, { bucket: "Unknown", rawBucket: "unknown", count: combinedCourses.filter((course) => course.ageBucket === "unknown").length }]
      : rows;
  }, [combinedCourses, ageChartMode]);

  const summary = useMemo(() => ({
    totalCourses: combinedCourses.length,
    multiVersionCourses: combinedCourses.filter((course) => course.hasMultipleVersions).length,
    undatedCourses: combinedCourses.filter((course) => course.ageBucket === "unknown").length,
    latestLinkedCourses: combinedCourses.filter((course) => course.info && course.latestVersion).length,
  }), [combinedCourses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Content Inventory</h1>
          <p className="text-muted-foreground">
            Browse LMS catalog metadata and version history by shared course ID, with current-state stats, aging, and filters.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/upload/master-content-inventory">
            <Upload className="mr-2 h-4 w-4" />
            Open Catalog Uploads
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <LibraryBig className="h-4 w-4 text-primary" />
              Catalog Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalCourses}</p>
            <p className="text-sm text-muted-foreground">Unique course IDs in the catalog.</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-primary" />
              Multi-Version Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.multiVersionCourses}</p>
            <p className="text-sm text-muted-foreground">Courses with more than one stored version.</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              Undated Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.undatedCourses}</p>
            <p className="text-sm text-muted-foreground">Courses without an update date or original publish date.</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Linked Metadata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.latestLinkedCourses}</p>
            <p className="text-sm text-muted-foreground">Courses that currently have both info and version data.</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Vertical Coverage</CardTitle>
              <Select value={verticalMode} onValueChange={(value) => setVerticalMode(value as VerticalMode)}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest version only</SelectItem>
                  <SelectItem value="historical">Historical any-version</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Shared page filters apply here. This local control only changes how vertical coverage is counted.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {verticalStats.map((vertical) => (
              <div key={vertical.label} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{vertical.label}</p>
                <p className="text-2xl font-bold">{vertical.count}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Catalog Age</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Based on latest version date, or LMS Course Info published date when no version date exists.
                </p>
              </div>
              <Select value={ageChartMode} onValueChange={(value) => setAgeChartMode(value as AgeChartMode)}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="include_unknown">Include unknown</SelectItem>
                  <SelectItem value="dated_only">Dated only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageChartData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2">
              {ageChartData.map((bucket) => (
                <Badge key={bucket.bucket} variant="outline">
                  {bucket.bucket}: {bucket.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Catalog Browser</CardTitle>
          <p className="text-sm text-muted-foreground">
            {browserFilteredCourses.length} course{browserFilteredCourses.length === 1 ? "" : "s"} match the current filters.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {browserFilteredCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No catalog records match the current filters.</p>
          ) : (
            <div className="space-y-3">
              {browserFilteredCourses.map((course) => {
                const isOpen = openCourseId === course.courseId;
                return (
                  <Collapsible key={course.courseId} open={isOpen} onOpenChange={(nextOpen) => setOpenCourseId(nextOpen ? course.courseId : null)}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <CardTitle className="text-base">{course.courseName}</CardTitle>
                                <Badge variant="outline">{course.courseId}</Badge>
                                {course.info ? <Badge variant="secondary">Info</Badge> : <Badge variant="outline">No Info</Badge>}
                                <Badge variant={course.hasMultipleVersions ? "secondary" : "outline"}>
                                  {course.versions.length} version{course.versions.length === 1 ? "" : "s"}
                                </Badge>
                                {course.applicableVerticals.map((vertical) => (
                                  <Badge key={vertical} variant="outline">{vertical}</Badge>
                                ))}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Latest version: {text(course.latestVersion?.course_version) || "—"} • Type: {course.contentType || "—"} • Tool: {course.authoringTool || "—"} • Age: {bucketLabel(course.ageBucket)}
                              </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">LMS Course Info</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm">
                                <p><span className="text-muted-foreground">Published Date:</span> {formatDate(course.info?.original_publish_date)}</p>
                                <p><span className="text-muted-foreground">Content Type:</span> {course.contentType || "—"}</p>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Backend URL:</span>
                                  <OpenLinkButton href={course.info?.backend_url} label="Open Backend" />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Frontend URL:</span>
                                  <OpenLinkButton href={course.info?.frontend_url} label="Open Frontend" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Latest Version Snapshot</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm">
                                <p><span className="text-muted-foreground">Course Version:</span> {text(course.latestVersion?.course_version) || "—"}</p>
                                <p><span className="text-muted-foreground">Update Date:</span> {formatDate(course.latestVersion?.published_date)}</p>
                                <p><span className="text-muted-foreground">Update Type:</span> {text(course.latestVersion?.change_type) || "—"}</p>
                                <p><span className="text-muted-foreground">Duration:</span> {text(course.latestVersion?.duration_minutes) || "—"}</p>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Lesson Plan:</span>
                                  <OpenLinkButton href={course.latestVersion?.lesson_plan} label="Open Lesson Plan" />
                                </div>
                                <p><span className="text-muted-foreground">Special:</span> {text(course.latestVersion?.special) || "—"}</p>
                                <p><span className="text-muted-foreground">Applies To:</span> {course.applicableVerticals.join(", ") || "—"}</p>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-sm font-medium">Version History</h3>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Course Version</TableHead>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Tool</TableHead>
                                  <TableHead>Update Date</TableHead>
                                  <TableHead>Update Type</TableHead>
                                  <TableHead>Lesson Plan</TableHead>
                                  <TableHead>Special</TableHead>
                                  <TableHead>Verticals</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {course.versions.map((version) => {
                                  const versionVerticals = getApplicableVerticals(version);
                                  return (
                                    <TableRow key={version.id || `${course.courseId}-${version.course_version}`}>
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          {version.course_version || "—"}
                                          {version.version_derived ? <Badge variant="secondary">Derived</Badge> : null}
                                        </div>
                                      </TableCell>
                                      <TableCell>{text(version.course_name) || "—"}</TableCell>
                                      <TableCell>{text(version.authoring_tool) || "—"}</TableCell>
                                      <TableCell>{formatDate(version.published_date)}</TableCell>
                                      <TableCell>{text(version.change_type) || "—"}</TableCell>
                                      <TableCell>
                                        <OpenLinkButton href={version.lesson_plan} label="Open Lesson Plan" />
                                      </TableCell>
                                      <TableCell>{text(version.special) || "—"}</TableCell>
                                      <TableCell>{versionVerticals.join(", ") || "—"}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
