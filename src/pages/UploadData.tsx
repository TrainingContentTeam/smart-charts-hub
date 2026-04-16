import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Link2, ChevronDown, ArrowUpDown, Check, ChevronsUpDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { parseLegacyCourseFile, type LegacyCourse } from "@/lib/parse-legacy-course";
import { parseModernCourseFile, type ModernCourse } from "@/lib/parse-modern-course";
import { parseSmeSurveyFile, type SmeCollaborationSurveyImport } from "@/lib/parse-sme-survey";
import { parseTimeSpentFile, type TimeSpentEntry } from "@/lib/parse-time-spent";
import { makeId, readLocalStore, writeLocalStore } from "@/lib/local-data-store";
import { normalizeProjectStatus } from "@/lib/project-status";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProjects, useUploadHistory } from "@/hooks/use-time-data";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { isCompletedProjectStatus } from "@/lib/project-status";

function compareYearLabel(a: string, b: string): number {
  const aYear = /^\d{4}$/.test(a) ? Number(a) : Number.NaN;
  const bYear = /^\d{4}$/.test(b) ? Number(b) : Number.NaN;
  if (!Number.isNaN(aYear) && !Number.isNaN(bYear)) return aYear - bYear;
  if (!Number.isNaN(aYear)) return -1;
  if (!Number.isNaN(bYear)) return 1;
  return a.localeCompare(b);
}

type UploadDiagnostics = {
  updatedProjects: number;
  insertedProjects: number;
  deletedProjects: number;
  clearedTimeEntries: number;
  insertedTimeEntries: number;
  clearedSurveyRows: number;
  insertedSurveyRows: number;
};

type UploadUser = {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
};

type StatusComparisonRow = {
  source: string;
  year: string;
  uploadTotal: number;
  uploadIncomplete: number;
  persistedTotal: number;
  persistedIncomplete: number;
};

type YearlyStatusComparisonRow = {
  year: string;
  uploadCompleted: number;
  uploadActive: number;
  persistedCompleted: number;
  persistedActive: number;
};

type StatusMismatchRow = {
  key: string;
  courseName: string;
  year: string;
  rawYear: string;
  source: string;
  issue: string;
  uploadStatus: string;
  persistedStatus: string;
};

type YearKeyDiagnosticsRow = {
  source: string;
  rawYear: string;
  normalizedYear: string;
  total: number;
  finalized: number;
  active: number;
  malformed: boolean;
};

type PersistedYearAuditRow = {
  year: string;
  total: number;
  finalized: number;
  active: number;
  statuses: string;
};

type StatusDiagnosticCourseRow = {
  key: string;
  courseName: string;
  year: string;
  rawYear: string;
  source: string;
  rawStatus: string;
  isComplete: boolean;
};

interface DropZoneProps {
  label: string;
  description: string;
  fileName: string;
  count: number | null;
  onFile: (file: File) => void;
  id: string;
}

interface SearchableProjectSelectProps {
  options: PreviewProjectVariant[];
  placeholder: string;
  emptyLabel: string;
  value?: string;
  onChange: (value: string) => void;
}

function DropZone({ label, description, fileName, count, onFile, id }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : fileName ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) onFile(file);
          }}
          onClick={() => document.getElementById(id)?.click()}
        >
          {fileName ? (
            <>
              <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">{count} entries found</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Drop file or click to browse</p>
              <p className="text-xs text-muted-foreground">.xlsx or .csv</p>
            </>
          )}
          <input id={id} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }} />
        </div>
      </CardContent>
    </Card>
  );
}

function SearchableProjectSelect({ options, placeholder, emptyLabel, value, onChange }: SearchableProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.key === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className="truncate">
            {selected ? `${selected.name} · ${selected.reportingYear || "unknown"} · ${selected.dataSource}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.key}
                value={`${option.name} ${option.reportingYear} ${option.dataSource}`}
                onSelect={() => {
                  onChange(option.key);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === option.key ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{option.name}</span>
                <span className="ml-auto pl-2 text-xs text-muted-foreground">{option.reportingYear || "unknown"} · {option.dataSource}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function courseKey(courseName: string, reportingYear?: string): string {
  return `${normKey(courseName)}::${normKey(reportingYear || "")}`;
}

function parseEntryYear(entryDate: string): number | null {
  if (!entryDate) return null;
  const match = entryDate.match(/^(\d{4})-/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

type ProjectCandidate = {
  key: string;
  id: string;
  reportingYear: string;
  dataSource: string;
};

type ResolveReason =
  | "no_candidate"
  | "single"
  | "exact_year"
  | "source_hint"
  | "fallback_latest"
  | "manual_override";

type ResolveResult = {
  key: string | null;
  reason: ResolveReason;
};

type SurveyResolveResult = {
  key: string | null;
  reason: "exact" | "no_candidate" | "manual_override";
};

type PreviewProjectVariant = {
  key: string;
  name: string;
  reportingYear: string;
  dataSource: string;
};

type SurveyNoMatchRecord = {
  id: string;
  course_name_key: string;
  original_course_name: string;
  reporting_year: string | null;
};

type TimeMatchOverrideRecord = {
  id: string;
  course_name_key: string;
  original_course_name: string;
  reporting_year: string | null;
  target_project_key: string;
};

function resolveProjectKeyForTimeEntry(entry: TimeSpentEntry, byName: Map<string, ProjectCandidate[]>): ResolveResult {
  return resolveProjectKeyForTimeEntryWithOverride(entry, byName, null);
}

function resolveProjectKeyForTimeEntryWithOverride(
  entry: TimeSpentEntry,
  byName: Map<string, ProjectCandidate[]>,
  manualOverrideKey: string | null,
): ResolveResult {
  if (manualOverrideKey) return { key: manualOverrideKey, reason: "manual_override" };
  const nameKey = normKey(entry.courseName);
  const candidates = byName.get(nameKey) || [];
  if (candidates.length === 0) return { key: null, reason: "no_candidate" };
  if (candidates.length === 1) return { key: candidates[0].key, reason: "single" };

  const entryYear = parseEntryYear(entry.date);
  if (entryYear !== null) {
    const exactYear = candidates.filter((c) => c.reportingYear === String(entryYear));
    if (exactYear.length > 0) return { key: exactYear[0].key, reason: "exact_year" };

    const preferredSource = entryYear <= 2025 ? "legacy" : "modern";
    const sourceMatch = candidates.filter((c) => c.dataSource === preferredSource);
    if (sourceMatch.length > 0) return { key: sourceMatch[0].key, reason: "source_hint" };
  }

  return {
    key: [...candidates].sort((a, b) => b.reportingYear.localeCompare(a.reportingYear))[0].key,
    reason: "fallback_latest",
  };
}

function resolveProjectKeyForSurvey(entry: SmeCollaborationSurveyImport, allCourseKeys: Set<string>): SurveyResolveResult {
  return resolveProjectKeyForSurveyWithOverride(entry, allCourseKeys, null);
}

function resolveProjectKeyForSurveyWithOverride(
  entry: SmeCollaborationSurveyImport,
  allCourseKeys: Set<string>,
  manualOverrideKey: string | null,
): SurveyResolveResult {
  if (manualOverrideKey) return { key: manualOverrideKey, reason: "manual_override" };
  const key = courseKey(entry.courseName, entry.reportingYear);
  if (allCourseKeys.has(key)) return { key, reason: "exact" };
  return { key: null, reason: "no_candidate" };
}

function buildPreviewProjectVariants(legacyData: LegacyCourse[] | null, modernData: ModernCourse[] | null) {
  const byName = new Map<string, PreviewProjectVariant[]>();
  const allKeys = new Set<string>();
  const allVariants: PreviewProjectVariant[] = [];

  const pushVariant = (variant: PreviewProjectVariant) => {
    allKeys.add(variant.key);
    if (!allVariants.some((entry) => entry.key === variant.key)) allVariants.push(variant);
    const nameKey = normKey(variant.name);
    const list = byName.get(nameKey) || [];
    if (!list.some((entry) => entry.key === variant.key)) {
      list.push(variant);
      byName.set(nameKey, list);
    }
  };

  (legacyData || []).forEach((course) => {
    pushVariant({
      key: courseKey(course.courseName, course.reportingYear),
      name: course.courseName,
      reportingYear: course.reportingYear,
      dataSource: "legacy",
    });
  });

  (modernData || []).forEach((course) => {
    pushVariant({
      key: courseKey(course.courseName, course.reportingYear),
      name: course.courseName,
      reportingYear: course.reportingYear,
      dataSource: "modern",
    });
  });

  byName.forEach((list) => list.sort((a, b) => a.reportingYear.localeCompare(b.reportingYear)));

  allVariants.sort((a, b) => a.name.localeCompare(b.name) || a.reportingYear.localeCompare(b.reportingYear));

  return { byName, allKeys, allVariants };
}

function replaceDateYear(date: string, reportingYear: string): string {
  const cleanYear = reportingYear.trim();
  if (!cleanYear) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${cleanYear}${date.slice(4)}`;
  return `${cleanYear}-01-01`;
}

function describeTimeResolution(reason: ResolveReason): string {
  switch (reason) {
    case "manual_override": return "Manually matched to a selected project";
    case "single": return "Matched to the only project with this course name";
    case "exact_year": return "Matched by course name and entry year";
    case "source_hint": return "Matched by source hint from the entry year";
    case "fallback_latest": return "Matched by fallback to the latest reporting year";
    default: return "No project matched this course name/date";
  }
}

function describeSurveyResolution(reason: SurveyResolveResult["reason"]): string {
  switch (reason) {
    case "manual_override": return "Manually matched to a selected project";
    case "exact": return "Matched by course name and year";
    default: return "Survey row has no Course Name + Year match";
  }
}

function getRefreshedDatasetType(hasCourseFiles: boolean, hasTimeFile: boolean, hasSmeFile: boolean): string {
  const parts: string[] = [];
  if (hasCourseFiles) parts.push("courses");
  if (hasTimeFile) parts.push("time_entries");
  if (hasSmeFile) parts.push("sme_surveys");
  return parts.join(",") || "unknown";
}

function parseDatasetType(value: string | null | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatDatasetLabel(key: string): string {
  switch (key) {
    case "courses":
      return "Courses";
    case "time_entries":
      return "Time Entries";
    case "sme_surveys":
      return "SME Surveys";
    case "project_batch":
      return "Project Batch";
    default:
      return key;
  }
}

function normalizeYearLabel(value: unknown): string {
  const year = String(value || "").trim();
  return year || "Unknown";
}

function normalizeSourceLabel(value: unknown): string {
  const source = String(value || "").trim().toLowerCase();
  if (source === "legacy") return "legacy";
  if (source === "modern") return "modern";
  return source || "unknown";
}

function isCleanFourDigitYear(value: unknown): boolean {
  return /^\d{4}$/.test(String(value || "").trim());
}

export default function UploadData() {
  const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
  const [legacyFile, setLegacyFile] = useState("");
  const [modernFile, setModernFile] = useState("");
  const [timeFile, setTimeFile] = useState("");
  const [smeFile, setSmeFile] = useState("");
  const [legacyData, setLegacyData] = useState<LegacyCourse[] | null>(null);
  const [modernData, setModernData] = useState<ModernCourse[] | null>(null);
  const [timeData, setTimeData] = useState<TimeSpentEntry[] | null>(null);
  const [smeData, setSmeData] = useState<SmeCollaborationSurveyImport[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [legacySortKey, setLegacySortKey] = useState<"course" | "hours" | "year" | "tool" | "vertical">("course");
  const [legacySortAsc, setLegacySortAsc] = useState(true);
  const [modernSortKey, setModernSortKey] = useState<"course" | "year" | "tool" | "vertical" | "type">("course");
  const [modernSortAsc, setModernSortAsc] = useState(true);
  const [timeSortKey, setTimeSortKey] = useState<"course" | "category" | "date" | "hours" | "user">("date");
  const [timeSortAsc, setTimeSortAsc] = useState(false);
  const [smeSortKey, setSmeSortKey] = useState<"course" | "year" | "sme" | "id" | "hours" | "billed">("course");
  const [smeSortAsc, setSmeSortAsc] = useState(true);
  const [historySortKey, setHistorySortKey] = useState<"file" | "rows" | "status" | "date">("date");
  const [historySortAsc, setHistorySortAsc] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState({
    blocking: true,
    fallback: true,
  });
  const [showMore, setShowMore] = useState({
    blockingTime: 10,
    blockingSurvey: 10,
  });
  const [timeOverrideKeys, setTimeOverrideKeys] = useState<Record<number, string | undefined>>({});
  const [surveyOverrideKeys, setSurveyOverrideKeys] = useState<Record<number, string | undefined>>({});
  const [canceledGroups, setCanceledGroups] = useState<Set<string>>(new Set());
  const [autoCanceledGroups, setAutoCanceledGroups] = useState<Set<string>>(new Set());
  const [surveyNoMatchKeys, setSurveyNoMatchKeys] = useState<Set<string>>(new Set());
  const [autoSurveyNoMatchKeys, setAutoSurveyNoMatchKeys] = useState<Set<string>>(new Set());
  const [autoTimeOverrideGroups, setAutoTimeOverrideGroups] = useState<Set<string>>(new Set());
  const [statusDiagnosticYear, setStatusDiagnosticYear] = useState<string>("all");
  const { data: history = [] } = useUploadHistory();
  const { data: persistedProjects = [] } = useProjects();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch previously canceled courses from database
  const { data: canceledCoursesFromDb = [] } = useQuery({
    queryKey: ["canceled_courses"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) return [];
      const { data, error } = await supabase
        .from("canceled_courses" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as Array<{ course_name_key: string; reporting_year: string | null; original_course_name: string }>;
    },
  });

  const { data: surveyNoMatchRecords = [] } = useQuery({
    queryKey: ["survey_no_match_records"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return (local.survey_no_match_records || []) as SurveyNoMatchRecord[];
      }
      const { data, error } = await supabase
        .from("survey_no_match_records" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as SurveyNoMatchRecord[];
    },
  });

  const { data: timeMatchOverrideRecords = [] } = useQuery({
    queryKey: ["time_match_overrides"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        return (local.time_match_overrides || []) as TimeMatchOverrideRecord[];
      }
      const { data, error } = await supabase
        .from("time_match_overrides" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as TimeMatchOverrideRecord[];
    },
  });

  const { data: uploadUsers = [] } = useQuery({
    queryKey: ["upload_history_users"],
    queryFn: async () => {
      if (DEV_BYPASS_AUTH) {
        return user?.id && user.email
          ? [{ user_id: user.id, email: user.email, role: "admin", created_at: new Date().toISOString() }]
          : [];
      }
      const { data, error } = await supabase.rpc("get_all_users_with_roles");
      if (error) throw error;
      return (data || []) as UploadUser[];
    },
  });

  const userEmailById = useMemo(() => {
    const map = new Map<string, string>();
    uploadUsers.forEach((entry) => {
      if (entry.user_id && entry.email) map.set(entry.user_id, entry.email);
    });
    if (user?.id && user.email) map.set(user.id, user.email);
    return map;
  }, [uploadUsers, user?.email, user?.id]);

  const latestCompletedImport = useMemo(() => {
    const rows = [...history]
      .filter((row: any) => String(row.status || "").toLowerCase() === "completed")
      .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return rows[0] || null;
  }, [history]);

  const latestImportDatasets = useMemo(
    () => parseDatasetType(latestCompletedImport?.dataset_type),
    [latestCompletedImport],
  );

  const latestImportUploader = useMemo(() => {
    if (!latestCompletedImport) return "Unknown uploader";
    const uploaderId = String(latestCompletedImport.user_id || "").trim();
    if (!uploaderId) return "Unknown uploader";
    const email = userEmailById.get(uploaderId);
    if (email) return email;
    if (user?.id === uploaderId && user.email) return user.email;
    return uploaderId;
  }, [latestCompletedImport, user?.email, user?.id, userEmailById]);

  const resetUploadState = useCallback(() => {
    setLegacyData(null); setModernData(null); setTimeData(null); setSmeData(null);
    setLegacyFile(""); setModernFile(""); setTimeFile(""); setSmeFile("");
    setWarnings([]);
    setTimeOverrideKeys({});
    setSurveyOverrideKeys({});
    setCanceledGroups(new Set());
    setAutoCanceledGroups(new Set());
    setSurveyNoMatchKeys(new Set());
    setAutoSurveyNoMatchKeys(new Set());
    setAutoTimeOverrideGroups(new Set());
  }, []);

  const invalidateImportedQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["time_entries"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["upload_history"] });
    queryClient.invalidateQueries({ queryKey: ["sme_surveys"] });
    queryClient.invalidateQueries({ queryKey: ["survey_no_match_records"] });
    queryClient.invalidateQueries({ queryKey: ["time_match_overrides"] });
    queryClient.invalidateQueries({ queryKey: ["canceled_courses"] });
    queryClient.invalidateQueries({ queryKey: ["lms_course_info"] });
    queryClient.invalidateQueries({ queryKey: ["lms_course_versions"] });
  }, [queryClient]);

  const showImportDiagnostics = useCallback((
    diagnostics: UploadDiagnostics,
    importedCourseCount: number,
    canceledSkipCount: number,
    unresolvedCount: number,
    unresolvedSurveyCount: number,
    retainedNoMatchSurveyCount: number,
    fallbackCount: number,
    sourceHintCount: number,
  ) => {
    toast.success(
      `Shared dataset refreshed. Courses ${importedCourseCount} imported, ${diagnostics.updatedProjects} updated, ${diagnostics.insertedProjects} added, ${diagnostics.deletedProjects} removed.`
    );
    toast.message(
      `Time entries: ${diagnostics.clearedTimeEntries} cleared, ${diagnostics.insertedTimeEntries} inserted. SME surveys: ${diagnostics.clearedSurveyRows} cleared, ${diagnostics.insertedSurveyRows} inserted.`
    );
    if (canceledSkipCount > 0) {
      toast.message(`${canceledSkipCount} time entries skipped from canceled projects.`);
    }
    if (unresolvedCount > 0) {
      toast.warning(`${unresolvedCount} time entries could not be matched to a project.`);
    }
    if (unresolvedSurveyCount > 0) {
      toast.warning(`${unresolvedSurveyCount} SME survey rows could not be matched by Course Name + Year.`);
    }
    if (retainedNoMatchSurveyCount > 0) {
      toast.message(`${retainedNoMatchSurveyCount} SME survey rows were retained as no-match records.`);
    }
    if (fallbackCount > 0) {
      toast.warning(`${fallbackCount} time entries used fallback mapping on duplicate course titles.`);
    }
    if (sourceHintCount > 0) {
      toast.message(`${sourceHintCount} time entries were disambiguated by date-year source hint.`);
    }
  }, []);
  const handleLegacy = useCallback(async (file: File) => {
    setLegacyFile(file.name);
    setTimeOverrideKeys({});
    setSurveyOverrideKeys({});
    setSurveyNoMatchKeys(new Set());
    setAutoSurveyNoMatchKeys(new Set());
    setAutoTimeOverrideGroups(new Set());
    try {
      const data = await parseLegacyCourseFile(file);
      setLegacyData(data);
      if (data.length === 0) toast.warning("No legacy course entries found.");
    } catch { toast.error("Failed to parse legacy course file."); }
  }, []);

  const handleModern = useCallback(async (file: File) => {
    setModernFile(file.name);
    setTimeOverrideKeys({});
    setSurveyOverrideKeys({});
    setSurveyNoMatchKeys(new Set());
    setAutoSurveyNoMatchKeys(new Set());
    setAutoTimeOverrideGroups(new Set());
    try {
      const data = await parseModernCourseFile(file);
      setModernData(data);
      if (data.length === 0) toast.warning("No modern course entries found.");
    } catch { toast.error("Failed to parse modern course file."); }
  }, []);

  const handleTime = useCallback(async (file: File) => {
    setTimeFile(file.name);
    setTimeOverrideKeys({});
    setAutoTimeOverrideGroups(new Set());
    try {
      const data = await parseTimeSpentFile(file);
      setTimeData(data);
      if (data.length === 0) toast.warning("No time spent entries found.");
    } catch { toast.error("Failed to parse time spent file."); }
  }, []);

  const handleSme = useCallback(async (file: File) => {
    setSmeFile(file.name);
    setSurveyOverrideKeys({});
    setSurveyNoMatchKeys(new Set());
    setAutoSurveyNoMatchKeys(new Set());
    setAutoTimeOverrideGroups(new Set());
    try {
      const data = await parseSmeSurveyFile(file);
      setSmeData(data);
      if (data.length === 0) toast.warning("No SME survey entries found.");
    } catch { toast.error("Failed to parse SME survey file."); }
  }, []);

  const updateTimeEntry = useCallback((index: number, patch: Partial<TimeSpentEntry>) => {
    setTimeData((current) => {
      if (!current) return current;
      return current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    });
  }, []);

  const updateTimeEntries = useCallback((indexes: number[], updater: (entry: TimeSpentEntry) => Partial<TimeSpentEntry>) => {
    setTimeData((current) => {
      if (!current) return current;
      const indexSet = new Set(indexes);
      return current.map((entry, i) => (indexSet.has(i) ? { ...entry, ...updater(entry) } : entry));
    });
  }, []);

  const updateSmeEntry = useCallback((index: number, patch: Partial<SmeCollaborationSurveyImport>) => {
    setSmeData((current) => {
      if (!current) return current;
      return current.map((entry, i) => {
        if (i !== index) return entry;
        const next = { ...entry, ...patch };
        return {
          ...next,
          effectiveHourlyRate: next.hoursWorked > 0 ? Math.round((next.amountBilled / next.hoursWorked) * 100) / 100 : null,
        };
      });
    });
  }, []);

  const setTimeOverride = useCallback((index: number, key: string | undefined) => {
    setTimeOverrideKeys((current) => {
      const next = { ...current };
      if (key) next[index] = key;
      else delete next[index];
      return next;
    });
  }, []);

  const setTimeOverrides = useCallback((indexes: number[], key: string | undefined) => {
    setTimeOverrideKeys((current) => {
      const next = { ...current };
      indexes.forEach((index) => {
        if (key) next[index] = key;
        else delete next[index];
      });
      return next;
    });
  }, []);

  const setSurveyOverride = useCallback((index: number, key: string | undefined) => {
    setSurveyOverrideKeys((current) => {
      const next = { ...current };
      if (key) next[index] = key;
      else delete next[index];
      return next;
    });
  }, []);

  const toggleSurveyNoMatchKey = useCallback((matchKey: string) => {
    setSurveyNoMatchKeys((prev) => {
      const next = new Set(prev);
      if (next.has(matchKey)) next.delete(matchKey);
      else next.add(matchKey);
      return next;
    });
  }, []);

  const previewProjects = useMemo(() => buildPreviewProjectVariants(legacyData, modernData), [legacyData, modernData]);
  const previewProjectCandidates = useMemo(
    () =>
      new Map(
        [...previewProjects.byName.entries()].map(([name, variants]) => [
          name,
          variants.map((variant) => ({
            key: variant.key,
            id: variant.key,
            reportingYear: variant.reportingYear,
            dataSource: variant.dataSource,
          })),
        ]),
      ),
    [previewProjects],
  );

  const persistedSurveyNoMatchKeySet = useMemo(
    () => new Set((surveyNoMatchRecords || []).map((record) => courseKey(record.original_course_name, record.reporting_year || ""))),
    [surveyNoMatchRecords],
  );

  // Match preview
  const matchInfo = useMemo(() => {
    if (!legacyData && !modernData && !timeData && !smeData) return null;
    const legacyNames = new Set((legacyData || []).map(c => normKey(c.courseName)));
    const modernNames = new Set((modernData || []).map(c => normKey(c.courseName)));
    const timeNames = new Set((timeData || []).map(e => normKey(e.courseName)));
    const surveyKeys = new Set((smeData || []).map((e) => courseKey(e.courseName, e.reportingYear)));
    const allCourseNames = new Set([...legacyNames, ...modernNames]);
    const allCourseKeys = new Set([
      ...(legacyData || []).map((c) => courseKey(c.courseName, c.reportingYear)),
      ...(modernData || []).map((c) => courseKey(c.courseName, c.reportingYear)),
    ]);
    const inProgress = [...timeNames].filter(n => !allCourseNames.has(n));
    const matched = [...allCourseNames].filter(n => timeNames.has(n));
    const warn: string[] = [];
    // Zero-hour entries
    const zeroHour = (timeData || []).filter(e => e.hours === 0);
    if (zeroHour.length > 0) warn.push(`${zeroHour.length} time entries with zero hours`);
    // Unmatched courses (in legacy/modern but not in time spent)
    const unmatched = [...allCourseNames].filter(n => !timeNames.has(n));
    if (unmatched.length > 0) warn.push(`${unmatched.length} courses with no time entries`);
    const unmatchedSurveyRows = [...surveyKeys].filter((key) => !allCourseKeys.has(key) && !persistedSurveyNoMatchKeySet.has(key)).length;
    if (unmatchedSurveyRows > 0) warn.push(`${unmatchedSurveyRows} SME survey rows could not be matched by Course Name + Year`);
    return {
      warn,
      legacyCount: legacyData?.length || 0,
      modernCount: modernData?.length || 0,
      timeUniqueCount: timeNames.size,
      timeEntryCount: timeData?.length || 0,
      smeEntryCount: smeData?.length || 0,
      smeMatchedCount: (smeData || []).filter((entry) => allCourseKeys.has(courseKey(entry.courseName, entry.reportingYear))).length,
      matched: matched.length,
      inProgress: inProgress.length,
      totalUnique: new Set([...allCourseNames, ...timeNames]).size,
    };
  }, [legacyData, modernData, timeData, smeData, persistedSurveyNoMatchKeySet]);

  useEffect(() => {
    setWarnings(matchInfo?.warn || []);
  }, [matchInfo]);

  const uploadStatusRows = useMemo(() => {
    const rows: StatusDiagnosticCourseRow[] = [];

    (legacyData || []).forEach((course) => {
      rows.push({
        key: courseKey(course.courseName, course.reportingYear),
        courseName: course.courseName,
        year: normalizeYearLabel(course.reportingYear),
        rawYear: String(course.reportingYear || "").trim(),
        source: "legacy",
        rawStatus: String(course.status || "").trim(),
        isComplete: isCompletedProjectStatus(course.status),
      });
    });

    (modernData || []).forEach((course) => {
      rows.push({
        key: courseKey(course.courseName, course.reportingYear),
        courseName: course.courseName,
        year: normalizeYearLabel(course.reportingYear),
        rawYear: String(course.reportingYear || "").trim(),
        source: "modern",
        rawStatus: String(course.status || "").trim(),
        isComplete: isCompletedProjectStatus(course.status),
      });
    });

    return rows;
  }, [legacyData, modernData]);

  const persistedStatusRows = useMemo(() => {
    return (persistedProjects as any[])
      .filter((project: any) => {
        const source = normalizeSourceLabel(project.data_source);
        return source === "legacy" || source === "modern";
      })
      .map((project: any) => ({
        key: courseKey(project.name, project.reporting_year),
        courseName: String(project.name || "").trim(),
        year: normalizeYearLabel(project.reporting_year),
        rawYear: String(project.reporting_year || "").trim(),
        source: normalizeSourceLabel(project.data_source),
        rawStatus: String(project.status || "").trim(),
        isComplete: isCompletedProjectStatus(project.status),
      }));
  }, [persistedProjects]);

  const availableStatusDiagnosticYears = useMemo(() => {
    const set = new Set<string>();
    uploadStatusRows.forEach((row) => set.add(row.year));
    persistedStatusRows.forEach((row) => set.add(row.year));
    return [...set].sort(compareYearLabel);
  }, [persistedStatusRows, uploadStatusRows]);

  const filteredUploadStatusRows = useMemo(
    () => uploadStatusRows.filter((row) => statusDiagnosticYear === "all" || row.year === statusDiagnosticYear),
    [statusDiagnosticYear, uploadStatusRows],
  );

  const filteredPersistedStatusRows = useMemo(
    () => persistedStatusRows.filter((row) => statusDiagnosticYear === "all" || row.year === statusDiagnosticYear),
    [persistedStatusRows, statusDiagnosticYear],
  );

  const dashboardStatusDiagnostics = useMemo(() => {
    const uploadMap = new Map(filteredUploadStatusRows.map((row) => [row.key, row]));
    const persistedMap = new Map(filteredPersistedStatusRows.map((row) => [row.key, row]));
    const counts = new Map<string, StatusComparisonRow>();

    const ensureCount = (source: string, year: string) => {
      const key = `${source}::${year}`;
      const existing = counts.get(key);
      if (existing) return existing;
      const next: StatusComparisonRow = {
        source,
        year,
        uploadTotal: 0,
        uploadIncomplete: 0,
        persistedTotal: 0,
        persistedIncomplete: 0,
      };
      counts.set(key, next);
      return next;
    };

    filteredUploadStatusRows.forEach((row) => {
      const entry = ensureCount(row.source, row.year);
      entry.uploadTotal += 1;
      if (!row.isComplete) entry.uploadIncomplete += 1;
    });

    filteredPersistedStatusRows.forEach((row) => {
      const entry = ensureCount(row.source, row.year);
      entry.persistedTotal += 1;
      if (!row.isComplete) entry.persistedIncomplete += 1;
    });

    const allKeys = new Set<string>([...uploadMap.keys(), ...persistedMap.keys()]);
    const mismatches: StatusMismatchRow[] = [];
    const yearlyCounts = new Map<string, YearlyStatusComparisonRow>();

    const ensureYearlyCount = (year: string) => {
      const existing = yearlyCounts.get(year);
      if (existing) return existing;
      const next: YearlyStatusComparisonRow = {
        year,
        uploadCompleted: 0,
        uploadActive: 0,
        persistedCompleted: 0,
        persistedActive: 0,
      };
      yearlyCounts.set(year, next);
      return next;
    };

    allKeys.forEach((key) => {
      const upload = uploadMap.get(key);
      const persisted = persistedMap.get(key);
      if (upload && !persisted) {
        mismatches.push({
          key,
          courseName: upload.courseName,
          year: upload.year,
          rawYear: upload.rawYear || "(blank)",
          source: upload.source,
          issue: "Missing from persisted projects",
          uploadStatus: upload.rawStatus || "(blank)",
          persistedStatus: "(missing)",
        });
        return;
      }
      if (!upload && persisted) {
        mismatches.push({
          key,
          courseName: persisted.courseName,
          year: persisted.year,
          rawYear: persisted.rawYear || "(blank)",
          source: persisted.source,
          issue: "Extra persisted project not in current upload",
          uploadStatus: "(missing)",
          persistedStatus: persisted.rawStatus || "(blank)",
        });
        return;
      }
      if (!upload || !persisted) return;
      if (
        upload.isComplete !== persisted.isComplete ||
        upload.rawStatus !== persisted.rawStatus ||
        upload.rawYear !== persisted.rawYear
      ) {
        mismatches.push({
          key,
          courseName: upload.courseName,
          year: upload.year,
          rawYear: persisted.rawYear || upload.rawYear || "(blank)",
          source: upload.source,
          issue: upload.rawYear !== persisted.rawYear
            ? "Reporting year mismatch"
            : upload.isComplete !== persisted.isComplete
              ? "Completion bucket mismatch"
              : "Raw status text mismatch",
          uploadStatus: upload.rawStatus || "(blank)",
          persistedStatus: persisted.rawStatus || "(blank)",
        });
      }
    });

    filteredUploadStatusRows.forEach((row) => {
      const entry = ensureYearlyCount(row.year);
      if (row.isComplete) entry.uploadCompleted += 1;
      else entry.uploadActive += 1;
    });

    filteredPersistedStatusRows.forEach((row) => {
      const entry = ensureYearlyCount(row.year);
      if (row.isComplete) entry.persistedCompleted += 1;
      else entry.persistedActive += 1;
    });

    const uploadIncomplete = filteredUploadStatusRows.filter((row) => !row.isComplete).length;
    const persistedIncomplete = filteredPersistedStatusRows.filter((row) => !row.isComplete).length;

    return {
      uploadTotal: filteredUploadStatusRows.length,
      uploadIncomplete,
      persistedTotal: filteredPersistedStatusRows.length,
      persistedIncomplete,
      dashboardDonutComplete: filteredPersistedStatusRows.length - persistedIncomplete,
      dashboardDonutIncomplete: persistedIncomplete,
      comparisonRows: [...counts.values()].sort((a, b) => a.source.localeCompare(b.source) || compareYearLabel(a.year, b.year)),
      yearlyRows: [...yearlyCounts.values()].sort((a, b) => compareYearLabel(a.year, b.year)),
      mismatchRows: mismatches.sort((a, b) => compareYearLabel(a.year, b.year) || a.courseName.localeCompare(b.courseName)),
    };
  }, [filteredPersistedStatusRows, filteredUploadStatusRows]);

  const rawYearDiagnostics = useMemo(() => {
    const counts = new Map<string, YearKeyDiagnosticsRow>();

    const addRow = (row: StatusDiagnosticCourseRow) => {
      const rawYear = row.rawYear || "(blank)";
      const key = `${row.source}::${rawYear}::${row.year}`;
      const existing = counts.get(key);
      if (existing) {
        existing.total += 1;
        if (row.isComplete) existing.finalized += 1;
        else existing.active += 1;
        return;
      }
      counts.set(key, {
        source: row.source,
        rawYear,
        normalizedYear: row.year,
        total: 1,
        finalized: row.isComplete ? 1 : 0,
        active: row.isComplete ? 0 : 1,
        malformed: !isCleanFourDigitYear(rawYear),
      });
    };

    uploadStatusRows.forEach(addRow);
    persistedStatusRows.forEach(addRow);

    return [...counts.values()].sort(
      (a, b) =>
        a.source.localeCompare(b.source) ||
        compareYearLabel(a.normalizedYear, b.normalizedYear) ||
        a.rawYear.localeCompare(b.rawYear),
    );
  }, [persistedStatusRows, uploadStatusRows]);

  const persistedYearAudit = useMemo(() => {
    const counts = new Map<string, { total: number; finalized: number; active: number; statuses: Set<string> }>();

    persistedStatusRows.forEach((row) => {
      const existing = counts.get(row.year) || { total: 0, finalized: 0, active: 0, statuses: new Set<string>() };
      existing.total += 1;
      if (row.isComplete) existing.finalized += 1;
      else existing.active += 1;
      existing.statuses.add(row.rawStatus || "(blank)");
      counts.set(row.year, existing);
    });

    return [...counts.entries()]
      .map(([year, value]) => ({
        year,
        total: value.total,
        finalized: value.finalized,
        active: value.active,
        statuses: [...value.statuses].sort().join(", "),
      }))
      .sort((a, b) => compareYearLabel(a.year, b.year));
  }, [persistedStatusRows]);

  const persisted2026Sample = useMemo(() => {
    return persistedStatusRows
      .filter((row) => row.year === "2026" || row.rawYear === "2026")
      .sort((a, b) => a.courseName.localeCompare(b.courseName))
      .slice(0, 20);
  }, [persistedStatusRows]);

  const timeIssueRows = useMemo(() => {
    if (!timeData) return [];
    return timeData.map((entry, index) => {
      const manualOverrideKey = timeOverrideKeys[index] || null;
      const resolved = resolveProjectKeyForTimeEntryWithOverride(entry, previewProjectCandidates, manualOverrideKey);
      const blockingReasons: string[] = [];
      const reviewReasons: string[] = [];
      if (resolved.reason === "no_candidate") blockingReasons.push("No project matched this course name/date");
      if (entry.hours === 0) blockingReasons.push("Zero hours detected");
      if (resolved.reason === "source_hint") reviewReasons.push("Matched by source hint");
      if (resolved.reason === "fallback_latest") reviewReasons.push("Matched by fallback to latest year");

      return {
        index,
        entry,
        resolved,
        blockingReasons,
        reviewReasons,
        suggestedCandidates: previewProjects.byName.get(normKey(entry.courseName)) || [],
        forceCandidates: previewProjects.allVariants,
      };
    });
  }, [timeData, previewProjects, previewProjectCandidates, timeOverrideKeys]);

  const surveyIssueRows = useMemo(() => {
    if (!smeData) return [];
    return smeData.map((entry, index) => {
      const manualOverrideKey = surveyOverrideKeys[index] || null;
      const resolved = resolveProjectKeyForSurveyWithOverride(entry, previewProjects.allKeys, manualOverrideKey);
      const matchKey = courseKey(entry.courseName, entry.reportingYear);
      return {
        index,
        entry,
        matchKey,
        resolved,
        blockingReasons: resolved.reason === "exact" || resolved.reason === "manual_override" ? [] : ["Survey row has no Course Name + Year match"],
        suggestedCandidates: previewProjects.byName.get(normKey(entry.courseName)) || [],
        forceCandidates: previewProjects.allVariants,
      };
    });
  }, [smeData, previewProjects, surveyOverrideKeys]);

  const blockingTimeRows = useMemo(() => timeIssueRows.filter((row) => row.blockingReasons.length > 0), [timeIssueRows]);
  const blockingSurveyRows = useMemo(
    () => surveyIssueRows.filter((row) => row.blockingReasons.length > 0 && !surveyNoMatchKeys.has(row.matchKey)),
    [surveyIssueRows, surveyNoMatchKeys],
  );
  const markedSurveyRows = useMemo(
    () => surveyIssueRows.filter((row) => row.blockingReasons.length > 0 && surveyNoMatchKeys.has(row.matchKey)),
    [surveyIssueRows, surveyNoMatchKeys],
  );
  const unmatchedTimeGroups = useMemo(() => {
    const groups = new Map<string, {
      groupKey: string;
      courseName: string;
      rows: typeof blockingTimeRows;
      suggestedCandidates: PreviewProjectVariant[];
      forceCandidates: PreviewProjectVariant[];
      activeOverrideKey: string | undefined;
      datePreview: string;
    }>();

    blockingTimeRows
      .filter((row) => row.resolved.reason === "no_candidate")
      .forEach((row) => {
        const groupKey = normKey(row.entry.courseName);
        const existing = groups.get(groupKey);
        if (existing) {
          existing.rows.push(row);
          existing.activeOverrideKey ||= timeOverrideKeys[row.index];
          return;
        }
        const dates = [row.entry.date, ...blockingTimeRows
          .filter((candidate) => candidate.resolved.reason === "no_candidate" && normKey(candidate.entry.courseName) === groupKey)
          .map((candidate) => candidate.entry.date)]
          .filter(Boolean);
        groups.set(groupKey, {
          groupKey,
          courseName: row.entry.courseName,
          rows: [row],
          suggestedCandidates: row.suggestedCandidates,
          forceCandidates: row.forceCandidates,
          activeOverrideKey: timeOverrideKeys[row.index],
          datePreview: [...new Set(dates)].slice(0, 3).join(", "),
        });
      });

    return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.courseName.localeCompare(b.courseName));
  }, [blockingTimeRows, timeOverrideKeys]);
  const individualBlockingTimeRows = useMemo(
    () => blockingTimeRows.filter((row) => row.resolved.reason !== "no_candidate"),
    [blockingTimeRows],
  );
  const hasReviewIssues = blockingTimeRows.length > 0 || blockingSurveyRows.length > 0;

  // Auto-detect previously canceled courses when unmatched groups change
  useEffect(() => {
    if (canceledCoursesFromDb.length === 0 || unmatchedTimeGroups.length === 0) return;
    const autoSet = new Set<string>();
    for (const group of unmatchedTimeGroups) {
      const nk = normKey(group.courseName);
      // Infer year from group entries
      const years = new Set<string>();
      group.rows.forEach((row) => {
        const y = parseEntryYear(row.entry.date);
        if (y !== null) years.add(String(y));
      });
      for (const dbRecord of canceledCoursesFromDb) {
        if (dbRecord.course_name_key === nk) {
          // Match if year matches or DB record has no year
          if (!dbRecord.reporting_year || years.has(dbRecord.reporting_year)) {
            autoSet.add(group.groupKey);
            break;
          }
        }
      }
    }
    if (autoSet.size > 0) {
      setCanceledGroups((prev) => new Set([...prev, ...autoSet]));
      setAutoCanceledGroups(autoSet);
    }
  }, [canceledCoursesFromDb, unmatchedTimeGroups]);

  useEffect(() => {
    if (timeMatchOverrideRecords.length === 0 || unmatchedTimeGroups.length === 0) return;
    const autoSet = new Set<string>();
    const nextOverrides: Record<number, string | undefined> = {};
    unmatchedTimeGroups.forEach((group) => {
      const years = new Set<string>();
      group.rows.forEach((row) => {
        const year = parseEntryYear(row.entry.date);
        if (year !== null) years.add(String(year));
      });
      const record = timeMatchOverrideRecords.find((candidate) => {
        if (candidate.course_name_key !== group.groupKey) return false;
        if (!candidate.reporting_year) return true;
        return years.has(candidate.reporting_year);
      });
      if (!record || group.activeOverrideKey) return;
      group.rows.forEach((row) => {
        nextOverrides[row.index] = record.target_project_key;
      });
      autoSet.add(group.groupKey);
    });
    if (Object.keys(nextOverrides).length > 0) {
      setTimeOverrideKeys((prev) => ({ ...nextOverrides, ...prev }));
      setAutoTimeOverrideGroups(autoSet);
    }
  }, [timeMatchOverrideRecords, unmatchedTimeGroups]);

  useEffect(() => {
    if (surveyNoMatchRecords.length === 0 || surveyIssueRows.length === 0) return;
    const autoSet = new Set<string>();
    surveyIssueRows
      .filter((row) => row.resolved.reason === "no_candidate")
      .forEach((row) => {
        if (persistedSurveyNoMatchKeySet.has(row.matchKey)) autoSet.add(row.matchKey);
      });
    if (autoSet.size > 0) {
      setSurveyNoMatchKeys((prev) => new Set([...prev, ...autoSet]));
      setAutoSurveyNoMatchKeys(autoSet);
    }
  }, [surveyIssueRows, surveyNoMatchRecords, persistedSurveyNoMatchKeySet]);

  const toggleCanceledGroup = useCallback((groupKey: string) => {
    setCanceledGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const importData = async () => {
    if (!legacyData && !modernData && !timeData && !smeData) return;
    setImporting(true);
    try {
      const totalRows = (legacyData?.length || 0) + (modernData?.length || 0) + (timeData?.length || 0) + (smeData?.length || 0);
      const combinedFileName = [legacyFile, modernFile, timeFile, smeFile].filter(Boolean).join(" + ");
      const hasCourseFiles = !!legacyData || !!modernData;
      const hasTimeFile = !!timeData;
      const hasSmeFile = !!smeData;
      const datasetType = getRefreshedDatasetType(hasCourseFiles, hasTimeFile, hasSmeFile);

      if (DEV_BYPASS_AUTH) {
        const now = new Date().toISOString();
        const uploadId = makeId();
        const local = await readLocalStore();
        const existingProjects = [...local.projects];
        const existingMap = new Map(existingProjects.map((p) => [courseKey(p.name, p.reporting_year), p]));
        const originalTimeCount = local.time_entries.length;
        const originalSurveyCount = local.sme_surveys.length;
        let updatedProjectCount = 0;
        let insertedProjectCount = 0;

        // Build course index with composite key: Course Name + Reporting Year
        const legacyMap = new Map<string, LegacyCourse>();
        (legacyData || []).forEach(c => legacyMap.set(courseKey(c.courseName, c.reportingYear), c));

        const modernMap = new Map<string, ModernCourse>();
        (modernData || []).forEach(c => modernMap.set(courseKey(c.courseName, c.reportingYear), c));

        const projectIdMap = new Map<string, string>();
        const projectCandidatesByName = new Map<string, ProjectCandidate[]>();
        const importedCourseCount = new Set([
          ...legacyMap.keys(),
          ...modernMap.keys(),
        ]).size;
        const allCourseKeys = new Set([
          ...existingMap.keys(),
          ...legacyMap.keys(),
          ...modernMap.keys(),
        ]);

        for (const key of allCourseKeys) {
          const legacy = legacyMap.get(key);
          const modern = modernMap.get(key);
          const existing = existingMap.get(key);

          let status: string;
          let totalHours: number;
          let dataSource: string;
          let meta: any = {};

          if (legacy) {
            status = normalizeProjectStatus(legacy.status, "In Progress");
            totalHours = legacy.totalHours;
            dataSource = "legacy";
            meta = {
              id_assigned: legacy.idAssigned,
              sme: legacy.sme,
              legal_reviewer: legacy.legalReviewer,
              vertical: legacy.vertical,
              course_type: legacy.courseType,
              authoring_tool: legacy.authoringTool,
              course_style: legacy.courseStyle,
              course_length: legacy.courseLength,
              content_hours: legacy.contentHours,
              interaction_count: legacy.interactionCount,
              reporting_year: legacy.reportingYear,
            };
          } else if (modern) {
            status = normalizeProjectStatus(modern.status, "In Progress");
            totalHours = modern.totalHours;
            dataSource = "modern";
            meta = {
              id_assigned: modern.idAssigned,
              sme: modern.sme,
              legal_reviewer: modern.legalReviewer,
              vertical: modern.vertical,
              course_type: modern.courseType,
              authoring_tool: modern.authoringTool,
              course_style: modern.courseStyle,
              course_length: modern.courseLength,
              content_hours: modern.contentHours,
              interaction_count: modern.interactionCount,
              reporting_year: modern.reportingYear,
            };
          } else {
            continue;
          }

          const nameOnlyKey = key.split("::")[0];
          const displayName = legacy?.courseName || modern?.courseName ||
            (timeData || []).find(e => normKey(e.courseName) === nameOnlyKey)?.courseName || nameOnlyKey;

          if (existing) {
            const idx = existingProjects.findIndex((p) => p.id === existing.id);
            const updated = {
              ...existing,
              name: displayName,
              status,
              total_hours: totalHours,
              data_source: dataSource,
              user_id: user?.id,
              updated_at: now,
              ...meta,
            };
            if (idx >= 0) existingProjects[idx] = updated as any;
            updatedProjectCount += 1;
            projectIdMap.set(key, existing.id);
            const candidates = projectCandidatesByName.get(nameOnlyKey) || [];
            candidates.push({
              key,
              id: existing.id,
              reportingYear: String((meta.reporting_year || (existing as any).reporting_year || "")).trim(),
              dataSource,
            });
            projectCandidatesByName.set(nameOnlyKey, candidates);
          } else {
            const insertedId = makeId();
            const inserted: any = {
              id: insertedId,
              name: displayName,
              status,
              total_hours: totalHours,
              data_source: dataSource,
              user_id: user?.id,
              created_at: now,
              updated_at: now,
              ...meta,
            };
            existingProjects.push(inserted);
            existingMap.set(key, inserted);
            insertedProjectCount += 1;
            projectIdMap.set(key, insertedId);
            const candidates = projectCandidatesByName.get(nameOnlyKey) || [];
            candidates.push({
              key,
              id: insertedId,
              reportingYear: String(inserted.reporting_year || "").trim(),
              dataSource,
            });
            projectCandidatesByName.set(nameOnlyKey, candidates);
          }
        }

        for (const [key, existing] of existingMap.entries()) {
          if (!projectIdMap.has(key)) projectIdMap.set(key, (existing as any).id);
          const nameOnlyKey = key.split("::")[0];
          const candidates = projectCandidatesByName.get(nameOnlyKey) || [];
          if (!candidates.some((candidate) => candidate.key === key)) {
            candidates.push({
              key,
              id: (existing as any).id,
              reportingYear: String((existing as any).reporting_year || "").trim(),
              dataSource: String((existing as any).data_source || "").trim(),
            });
            projectCandidatesByName.set(nameOnlyKey, candidates);
          }
        }

        const staleProjectIds = hasCourseFiles
          ? existingProjects
              .filter((project) => {
                const ds = String((project as any).data_source || "").toLowerCase();
                return (ds === "legacy" || ds === "modern") && !legacyMap.has(courseKey(project.name, project.reporting_year)) && !modernMap.has(courseKey(project.name, project.reporting_year));
              })
              .map((project) => project.id)
          : [];
        const retainedProjects = staleProjectIds.length > 0
          ? existingProjects.filter((project) => !staleProjectIds.includes(project.id))
          : existingProjects;
        const deletedProjectCount = staleProjectIds.length;

        let timeCount = 0;
        let unresolvedCount = 0;
        let fallbackCount = 0;
        let sourceHintCount = 0;
        const localTimeEntries = hasTimeFile
          ? []
          : staleProjectIds.length > 0
            ? local.time_entries.filter((entry) => !entry.project_id || !staleProjectIds.includes(entry.project_id))
            : [...local.time_entries];
        const localSmeSurveys = hasSmeFile
          ? []
          : staleProjectIds.length > 0
            ? local.sme_surveys.filter((row) => !row.project_id || !staleProjectIds.includes(row.project_id))
            : [...local.sme_surveys];
        const localSurveyNoMatchRecords = [...(local.survey_no_match_records || [])];
        const localTimeMatchOverrides = [...(local.time_match_overrides || [])];
        let surveyCount = 0;
        let unresolvedSurveyCount = 0;
        let retainedNoMatchSurveyCount = 0;
        // Build set of canceled course name keys to skip
        const canceledNameKeys = new Set<string>();
        for (const group of unmatchedTimeGroups) {
          if (canceledGroups.has(group.groupKey)) canceledNameKeys.add(group.groupKey);
        }
        let canceledSkipCount = 0;

        const currentTimeOverrideRows = unmatchedTimeGroups
          .map((group) => {
            const years = new Set<string>();
            group.rows.forEach((row) => {
              const year = parseEntryYear(row.entry.date);
              if (year !== null) years.add(String(year));
            });
            const reportingYear = years.size === 1 ? [...years][0] : null;
            return {
              groupKey: group.groupKey,
              courseName: group.courseName,
              reportingYear,
              targetProjectKey: group.activeOverrideKey,
            };
          });
        const seenTimeOverrideKeys = new Set(currentTimeOverrideRows.map((row) => courseKey(row.courseName, row.reportingYear || "")));
        const retainedTimeOverrides = localTimeMatchOverrides.filter((record) => {
          const key = courseKey(record.original_course_name, record.reporting_year || "");
          return !seenTimeOverrideKeys.has(key) || currentTimeOverrideRows.some((row) => courseKey(row.courseName, row.reportingYear || "") === key && row.targetProjectKey);
        });
        currentTimeOverrideRows.forEach((row) => {
          if (!row.targetProjectKey) return;
          const key = courseKey(row.courseName, row.reportingYear || "");
          const existing = retainedTimeOverrides.find((record) => courseKey(record.original_course_name, record.reporting_year || "") === key);
          if (existing) {
            existing.target_project_key = row.targetProjectKey;
            existing.original_course_name = row.courseName;
            return;
          }
          retainedTimeOverrides.push({
            id: makeId(),
            course_name_key: row.groupKey,
            original_course_name: row.courseName,
            reporting_year: row.reportingYear,
            target_project_key: row.targetProjectKey,
            user_id: user?.id,
            created_at: now,
          } as any);
        });

        if (timeData && timeData.length > 0) {
          for (let index = 0; index < timeData.length; index += 1) {
            const e = timeData[index];
            // Skip canceled groups
            if (canceledNameKeys.has(normKey(e.courseName))) {
              canceledSkipCount += 1;
              continue;
            }
            const resolved = resolveProjectKeyForTimeEntryWithOverride(e, projectCandidatesByName, timeOverrideKeys[index] || null);
            if (!resolved.key) unresolvedCount += 1;
            if (resolved.reason === "fallback_latest") fallbackCount += 1;
            if (resolved.reason === "source_hint") sourceHintCount += 1;
            localTimeEntries.push({
              id: makeId(),
              project_id: resolved.key ? projectIdMap.get(resolved.key) || null : null,
              phase: e.category || "Uncategorized",
              hours: e.hours,
              category: e.category,
              entry_date: e.date || null,
              user_name: e.userName,
              upload_id: uploadId,
              user_id: user?.id,
              created_at: now,
            } as any);
            timeCount += 1;
          }
        }

        if (smeData && smeData.length > 0) {
          const currentSurveyNoMatchKeys = new Set(
            surveyIssueRows
              .filter((row) => row.resolved.reason === "no_candidate" && surveyNoMatchKeys.has(row.matchKey))
              .map((row) => row.matchKey),
          );
          const seenSurveyNoMatchKeys = new Set(
            surveyIssueRows
              .filter((row) => row.resolved.reason === "no_candidate")
              .map((row) => row.matchKey),
          );
          const retainedRecords = localSurveyNoMatchRecords.filter((record) => {
            const key = courseKey(record.original_course_name, record.reporting_year || "");
            return !seenSurveyNoMatchKeys.has(key) || currentSurveyNoMatchKeys.has(key);
          });
          currentSurveyNoMatchKeys.forEach((matchKey) => {
            if (retainedRecords.some((record) => courseKey(record.original_course_name, record.reporting_year || "") === matchKey)) return;
            const row = surveyIssueRows.find((candidate) => candidate.matchKey === matchKey);
            if (!row) return;
            retainedRecords.push({
              id: makeId(),
              course_name_key: normKey(row.entry.courseName),
              original_course_name: row.entry.courseName,
              reporting_year: row.entry.reportingYear || null,
              user_id: user?.id,
              created_at: now,
            } as any);
          });

          for (let index = 0; index < smeData.length; index += 1) {
            const e = smeData[index];
            const resolved = resolveProjectKeyForSurveyWithOverride(e, allCourseKeys, surveyOverrideKeys[index] || null);
            const matchKey = courseKey(e.courseName, e.reportingYear);
            const isMarkedNoMatch = surveyNoMatchKeys.has(matchKey) && resolved.reason === "no_candidate";
            if (!resolved.key && !isMarkedNoMatch) unresolvedSurveyCount += 1;
            if (isMarkedNoMatch) retainedNoMatchSurveyCount += 1;
            localSmeSurveys.push({
              id: makeId(),
              project_id: resolved.key ? projectIdMap.get(resolved.key) || null : null,
              upload_id: uploadId,
              user_id: user?.id,
              course_key_raw: e.courseKeyRaw || null,
              course_name: e.courseName,
              reporting_year: e.reportingYear || null,
              hours_worked: e.hoursWorked,
              amount_billed: e.amountBilled,
              effective_hourly_rate: e.effectiveHourlyRate,
              survey_date: e.surveyDate || null,
              sme: e.sme || null,
              sme_email: e.smeEmail || null,
              internal: e.internal,
              sme_overall_experience_score: e.smeOverallExperienceScore,
              clarity_goals_score: e.clarityGoalsScore,
              staff_responsiveness_score: e.staffResponsivenessScore,
              tools_resources_score: e.toolsResourcesScore,
              training_support_score: e.trainingSupportScore,
              use_expertise_score: e.useExpertiseScore,
              incorporation_feedback_score: e.incorporationFeedbackScore,
              autonomy_course_design_score: e.autonomyCourseDesignScore,
              feeling_valued_score: e.feelingValuedScore,
              recommend_lexipol_score: e.recommendLexipolScore,
              additional_feedback_sme: e.additionalFeedbackSme || null,
              instructional_designer: e.instructionalDesigner || null,
              id_overall_collaboration_score: e.idOverallCollaborationScore,
              id_sme_knowledge_score: e.idSmeKnowledgeScore,
              id_responsiveness_score: e.idResponsivenessScore,
              id_instructional_design_knowledge_score: e.idInstructionalDesignKnowledgeScore,
              id_contribution_development_score: e.idContributionDevelopmentScore,
              id_openness_feedback_score: e.idOpennessFeedbackScore,
              id_deadlines_schedule_score: e.idDeadlinesScheduleScore,
              id_overall_quality_score: e.idOverallQualityScore,
              id_assistance_interactions_score: e.idAssistanceInteractionsScore,
              id_realworld_examples_included: e.idRealworldExamplesIncluded,
              id_sme_promoter_score: e.idSmePromoterScore,
              additional_comments_id: e.additionalCommentsId || null,
              source_created_at: e.sourceCreatedAt || null,
              source_row: null,
              created_at: now,
            });
            surveyCount += 1;
          }

          localSurveyNoMatchRecords.splice(0, localSurveyNoMatchRecords.length, ...retainedRecords);
        }

        const uploadHistory = [
          {
            id: uploadId,
            file_name: combinedFileName,
            row_count: totalRows,
            status: "completed",
            dataset_type: datasetType,
            user_id: user?.id,
            created_at: now,
          },
          ...local.upload_history,
        ];

        await writeLocalStore({
          projects: retainedProjects as any,
          time_entries: localTimeEntries as any,
          upload_history: uploadHistory as any,
          sme_surveys: localSmeSurveys as any,
          survey_no_match_records: localSurveyNoMatchRecords as any,
          time_match_overrides: retainedTimeOverrides as any,
        });

        showImportDiagnostics(
          {
            updatedProjects: updatedProjectCount,
            insertedProjects: insertedProjectCount,
            deletedProjects: deletedProjectCount,
            clearedTimeEntries: hasTimeFile ? originalTimeCount : 0,
            insertedTimeEntries: timeCount,
            clearedSurveyRows: hasSmeFile ? originalSurveyCount : 0,
            insertedSurveyRows: surveyCount,
          },
          importedCourseCount,
          canceledSkipCount,
          unresolvedCount,
          unresolvedSurveyCount,
          retainedNoMatchSurveyCount,
          fallbackCount,
          sourceHintCount,
        );
        resetUploadState();
        invalidateImportedQueries();
        return;
      }

      // Upload history
      const { data: upload, error: uploadErr } = await supabase
        .from("upload_history")
        .insert({ file_name: combinedFileName, row_count: totalRows, dataset_type: datasetType, user_id: user!.id })
        .select()
        .single();
      if (uploadErr) throw uploadErr;

      // Build course index with composite key: Course Name + Reporting Year
      const legacyMap = new Map<string, LegacyCourse>();
      (legacyData || []).forEach(c => legacyMap.set(courseKey(c.courseName, c.reportingYear), c));

      const modernMap = new Map<string, ModernCourse>();
      (modernData || []).forEach(c => modernMap.set(courseKey(c.courseName, c.reportingYear), c));

      // Get existing projects keyed the same way (Course Name + reporting_year)
      const existingProjects = (await supabase.from("projects").select("*")).data || [];
      const existingMap = new Map(existingProjects.map((p: any) => [courseKey(p.name, p.reporting_year), p]));
      let updatedProjectCount = 0;
      let insertedProjectCount = 0;

      // Upsert projects
      const projectIdMap = new Map<string, string>();
      const projectCandidatesByName = new Map<string, ProjectCandidate[]>();
      const fileCourseKeys = new Set([
        ...legacyMap.keys(),
        ...modernMap.keys(),
      ]);
      const importedCourseCount = fileCourseKeys.size;
      const allCourseKeys = new Set([
        ...existingMap.keys(),
        ...fileCourseKeys,
      ]);

      for (const key of allCourseKeys) {
        const legacy = legacyMap.get(key);
        const modern = modernMap.get(key);
        const existing = existingMap.get(key);

        let status: string;
        let totalHours: number;
        let dataSource: string;
        let meta: any = {};

        if (legacy) {
          status = normalizeProjectStatus(legacy.status, "In Progress");
          totalHours = legacy.totalHours;
          dataSource = "legacy";
          meta = {
            id_assigned: legacy.idAssigned,
            sme: legacy.sme,
            legal_reviewer: legacy.legalReviewer,
            vertical: legacy.vertical,
            course_type: legacy.courseType,
            authoring_tool: legacy.authoringTool,
            course_style: legacy.courseStyle,
            course_length: legacy.courseLength,
            content_hours: legacy.contentHours,
            interaction_count: legacy.interactionCount,
            reporting_year: legacy.reportingYear,
          };
        } else if (modern) {
          status = normalizeProjectStatus(modern.status, "In Progress");
          totalHours = modern.totalHours;
          dataSource = "modern";
          meta = {
            id_assigned: modern.idAssigned,
            sme: modern.sme,
            legal_reviewer: modern.legalReviewer,
            vertical: modern.vertical,
            course_type: modern.courseType,
            authoring_tool: modern.authoringTool,
            course_style: modern.courseStyle,
            course_length: modern.courseLength,
            content_hours: modern.contentHours,
            interaction_count: modern.interactionCount,
            reporting_year: modern.reportingYear,
          };
        } else {
          continue;
        }

        const nameOnlyKey = key.split("::")[0];
        const displayName = legacy?.courseName || modern?.courseName ||
          (timeData || []).find(e => normKey(e.courseName) === nameOnlyKey)?.courseName || nameOnlyKey;

        if (existing) {
          await supabase
            .from("projects")
            .update({ status, total_hours: totalHours, data_source: dataSource, user_id: user!.id, ...meta } as any)
            .eq("id", existing.id);
          updatedProjectCount += 1;
          projectIdMap.set(key, existing.id);
          const candidates = projectCandidatesByName.get(nameOnlyKey) || [];
          candidates.push({
            key,
            id: existing.id,
            reportingYear: String((meta.reporting_year || existing.reporting_year || "")).trim(),
            dataSource,
          });
          projectCandidatesByName.set(nameOnlyKey, candidates);
        } else {
          const { data: inserted } = await supabase
            .from("projects")
            .insert({ name: displayName, status, total_hours: totalHours, data_source: dataSource, user_id: user!.id, ...meta } as any)
            .select()
            .single();
          if (inserted) {
            insertedProjectCount += 1;
            projectIdMap.set(key, inserted.id);
            existingMap.set(key, inserted);
            const candidates = projectCandidatesByName.get(nameOnlyKey) || [];
            candidates.push({
              key,
              id: inserted.id,
              reportingYear: String((inserted as any).reporting_year || "").trim(),
              dataSource,
            });
            projectCandidatesByName.set(nameOnlyKey, candidates);
          }
        }
      }

      for (const [key, existing] of existingMap.entries()) {
        if (!projectIdMap.has(key)) projectIdMap.set(key, (existing as any).id);
        const nameOnlyKey = key.split("::")[0];
        const candidates = projectCandidatesByName.get(nameOnlyKey) || [];
        if (!candidates.some((candidate) => candidate.key === key)) {
          candidates.push({
            key,
            id: (existing as any).id,
            reportingYear: String((existing as any).reporting_year || "").trim(),
            dataSource: String((existing as any).data_source || "").trim(),
          });
          projectCandidatesByName.set(nameOnlyKey, candidates);
        }
      }

      // Clean up stale projects no longer in source files
      const staleProjectIds: string[] = [];
      if (hasCourseFiles) {
        for (const [key, existing] of existingMap.entries()) {
          const ds = ((existing as any).data_source || "").toLowerCase();
          if ((ds === "legacy" || ds === "modern") && !fileCourseKeys.has(key)) {
            staleProjectIds.push((existing as any).id);
          }
        }
      }
      if (staleProjectIds.length > 0) {
        console.log(`Cleaning up ${staleProjectIds.length} stale projects no longer in source files`);
        // Delete related time_entries first (FK constraint)
        for (let i = 0; i < staleProjectIds.length; i += 50) {
          const batch = staleProjectIds.slice(i, i + 50);
          await supabase.from("time_entries").delete().in("project_id", batch);
          await supabase.from("sme_collaboration_surveys").delete().in("project_id", batch);
          await supabase.from("projects").delete().in("id", batch);
        }
      }
      const deletedProjectCount = staleProjectIds.length;

      // Insert time entries from Time Spent file
      let timeCount = 0;
      let unresolvedCount = 0;
      let fallbackCount = 0;
      let sourceHintCount = 0;
      let surveyCount = 0;
      let unresolvedSurveyCount = 0;
      let retainedNoMatchSurveyCount = 0;
      let clearedTimeCount = 0;
      let clearedSurveyCount = 0;

      // Build set of canceled course name keys to skip
      const canceledNameKeys = new Set<string>();
      for (const group of unmatchedTimeGroups) {
        if (canceledGroups.has(group.groupKey)) canceledNameKeys.add(group.groupKey);
      }
      let canceledSkipCount = 0;

      // Persist canceled courses to database
      if (canceledNameKeys.size > 0) {
        const canceledInserts: Array<{ course_name_key: string; reporting_year: string | null; original_course_name: string; user_id: string }> = [];
        for (const group of unmatchedTimeGroups) {
          if (!canceledGroups.has(group.groupKey)) continue;
          const years = new Set<string>();
          group.rows.forEach((row) => {
            const y = parseEntryYear(row.entry.date);
            if (y !== null) years.add(String(y));
          });
          const reportingYear = years.size === 1 ? [...years][0] : null;
          canceledInserts.push({
            course_name_key: group.groupKey,
            reporting_year: reportingYear,
            original_course_name: group.courseName,
            user_id: user!.id,
          });
        }
      if (canceledInserts.length > 0) {
          await supabase.from("canceled_courses" as any).upsert(canceledInserts as any, { onConflict: "course_name_key,reporting_year" });
        }
      }

      if (hasTimeFile) {
        const { count: existingTimeCount } = await supabase
          .from("time_entries")
          .select("id", { count: "exact", head: true });
        clearedTimeCount = existingTimeCount || 0;
        const { error: clearTimeErr } = await supabase.from("time_entries").delete().not("id", "is", null);
        if (clearTimeErr) throw clearTimeErr;
      }

      if (hasSmeFile) {
        const { count: existingSurveyCount } = await supabase
          .from("sme_collaboration_surveys")
          .select("id", { count: "exact", head: true });
        clearedSurveyCount = existingSurveyCount || 0;
        const { error: clearSurveyErr } = await supabase.from("sme_collaboration_surveys").delete().not("id", "is", null);
        if (clearSurveyErr) throw clearSurveyErr;
      }

      const currentTimeOverrideRows = unmatchedTimeGroups.map((group) => {
        const years = new Set<string>();
        group.rows.forEach((row) => {
          const year = parseEntryYear(row.entry.date);
          if (year !== null) years.add(String(year));
        });
        return {
          groupKey: group.groupKey,
          courseName: group.courseName,
          reportingYear: years.size === 1 ? [...years][0] : null,
          targetProjectKey: group.activeOverrideKey,
        };
      });
      const seenTimeOverrideKeys = new Set(currentTimeOverrideRows.map((row) => courseKey(row.courseName, row.reportingYear || "")));
      const timeOverrideDeletes = timeMatchOverrideRecords.filter((record) => {
        const key = courseKey(record.original_course_name, record.reporting_year || "");
        return seenTimeOverrideKeys.has(key) && !currentTimeOverrideRows.some((row) => courseKey(row.courseName, row.reportingYear || "") === key && row.targetProjectKey);
      });
      if (timeOverrideDeletes.length > 0) {
        await supabase.from("time_match_overrides" as any).delete().in("id", timeOverrideDeletes.map((record) => record.id));
      }
      const timeOverrideUpserts = currentTimeOverrideRows.filter((row) => row.targetProjectKey);
      if (timeOverrideUpserts.length > 0) {
        await supabase.from("time_match_overrides" as any).upsert(
          timeOverrideUpserts.map((row) => ({
            course_name_key: row.groupKey,
            original_course_name: row.courseName,
            reporting_year: row.reportingYear,
            target_project_key: row.targetProjectKey,
            user_id: user!.id,
          })) as any,
          { onConflict: "course_name_key,reporting_year" },
        );
      }

      const currentMarkedSurveyRows = surveyIssueRows.filter((row) => row.resolved.reason === "no_candidate" && surveyNoMatchKeys.has(row.matchKey));
      const currentMarkedSurveyKeys = new Set(currentMarkedSurveyRows.map((row) => row.matchKey));
      const seenSurveyNoMatchKeys = new Set(
        surveyIssueRows
          .filter((row) => row.resolved.reason === "no_candidate")
          .map((row) => row.matchKey),
      );
      const surveyNoMatchDeletes = surveyNoMatchRecords.filter((record) => {
        const key = courseKey(record.original_course_name, record.reporting_year || "");
        return seenSurveyNoMatchKeys.has(key) && !currentMarkedSurveyKeys.has(key);
      });
      if (surveyNoMatchDeletes.length > 0) {
        await supabase.from("survey_no_match_records" as any).delete().in("id", surveyNoMatchDeletes.map((record) => record.id));
      }
      if (currentMarkedSurveyRows.length > 0) {
        await supabase.from("survey_no_match_records" as any).upsert(
          currentMarkedSurveyRows.map((row) => ({
            course_name_key: normKey(row.entry.courseName),
            original_course_name: row.entry.courseName,
            reporting_year: row.entry.reportingYear || null,
            user_id: user!.id,
          })) as any,
          { onConflict: "course_name_key,reporting_year" },
        );
      }

      if (timeData && timeData.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < timeData.length; i += batchSize) {
          const batch = timeData.slice(i, i + batchSize)
            .map((e, offset) => {
              const index = i + offset;
              // Skip canceled groups
              if (canceledNameKeys.has(normKey(e.courseName))) {
                canceledSkipCount += 1;
                return null;
              }
              const resolved = resolveProjectKeyForTimeEntryWithOverride(e, projectCandidatesByName, timeOverrideKeys[index] || null);
              if (!resolved.key) unresolvedCount += 1;
              if (resolved.reason === "fallback_latest") fallbackCount += 1;
              if (resolved.reason === "source_hint") sourceHintCount += 1;
              return {
                project_id: resolved.key ? projectIdMap.get(resolved.key) || null : null,
                phase: e.category || "Uncategorized",
                hours: e.hours,
                category: e.category,
                entry_date: e.date || null,
                user_name: e.userName,
                upload_id: upload.id,
                user_id: user!.id,
              };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);
          if (batch.length > 0) {
            const { error: entryErr } = await supabase.from("time_entries").insert(batch as any);
            if (entryErr) throw entryErr;
          }
          timeCount += batch.length;
        }
      }

      if (smeData && smeData.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < smeData.length; i += batchSize) {
          const batch = smeData.slice(i, i + batchSize).map((e, offset) => {
            const index = i + offset;
            const resolved = resolveProjectKeyForSurveyWithOverride(e, allCourseKeys, surveyOverrideKeys[index] || null);
            const matchKey = courseKey(e.courseName, e.reportingYear);
            const isMarkedNoMatch = surveyNoMatchKeys.has(matchKey) && resolved.reason === "no_candidate";
            if (!resolved.key && !isMarkedNoMatch) unresolvedSurveyCount += 1;
            if (isMarkedNoMatch) retainedNoMatchSurveyCount += 1;
            return {
              project_id: resolved.key ? projectIdMap.get(resolved.key) || null : null,
              upload_id: upload.id,
              user_id: user!.id,
              course_key_raw: e.courseKeyRaw || null,
              course_name: e.courseName,
              reporting_year: e.reportingYear || null,
              hours_worked: e.hoursWorked,
              amount_billed: e.amountBilled,
              effective_hourly_rate: e.effectiveHourlyRate,
              survey_date: e.surveyDate || null,
              sme: e.sme || null,
              sme_email: e.smeEmail || null,
              internal: e.internal,
              sme_overall_experience_score: e.smeOverallExperienceScore,
              clarity_goals_score: e.clarityGoalsScore,
              staff_responsiveness_score: e.staffResponsivenessScore,
              tools_resources_score: e.toolsResourcesScore,
              training_support_score: e.trainingSupportScore,
              use_expertise_score: e.useExpertiseScore,
              incorporation_feedback_score: e.incorporationFeedbackScore,
              autonomy_course_design_score: e.autonomyCourseDesignScore,
              feeling_valued_score: e.feelingValuedScore,
              recommend_lexipol_score: e.recommendLexipolScore,
              additional_feedback_sme: e.additionalFeedbackSme || null,
              instructional_designer: e.instructionalDesigner || null,
              id_overall_collaboration_score: e.idOverallCollaborationScore,
              id_sme_knowledge_score: e.idSmeKnowledgeScore,
              id_responsiveness_score: e.idResponsivenessScore,
              id_instructional_design_knowledge_score: e.idInstructionalDesignKnowledgeScore,
              id_contribution_development_score: e.idContributionDevelopmentScore,
              id_openness_feedback_score: e.idOpennessFeedbackScore,
              id_deadlines_schedule_score: e.idDeadlinesScheduleScore,
              id_overall_quality_score: e.idOverallQualityScore,
              id_assistance_interactions_score: e.idAssistanceInteractionsScore,
              id_realworld_examples_included: e.idRealworldExamplesIncluded == null ? null : e.idRealworldExamplesIncluded ? "Yes" : "No",
              id_sme_promoter_score: e.idSmePromoterScore,
              additional_comments_id: e.additionalCommentsId || null,
              source_created_at: e.sourceCreatedAt || null,
              source_row: null,
            };
          });
          const { error: surveyErr } = await supabase.from("sme_collaboration_surveys").insert(batch as any);
          if (surveyErr) throw surveyErr;
          surveyCount += batch.length;
        }
      }

      showImportDiagnostics(
        {
          updatedProjects: updatedProjectCount,
          insertedProjects: insertedProjectCount,
          deletedProjects: deletedProjectCount,
          clearedTimeEntries: clearedTimeCount,
          insertedTimeEntries: timeCount,
          clearedSurveyRows: clearedSurveyCount,
          insertedSurveyRows: surveyCount,
        },
        importedCourseCount,
        canceledSkipCount,
        unresolvedCount,
        unresolvedSurveyCount,
        retainedNoMatchSurveyCount,
        fallbackCount,
        sourceHintCount,
      );
      resetUploadState();
      invalidateImportedQueries();
    } catch (err: any) {
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const hasAnything = legacyData || modernData || timeData || smeData;
  const hasCourseFilesLoaded = !!legacyData || !!modernData;

  const sortedLegacyData = useMemo(() => {
    const rows = [...(legacyData || [])];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (legacySortKey) {
        case "course": cmp = a.courseName.localeCompare(b.courseName); break;
        case "hours": cmp = a.totalHours - b.totalHours; break;
        case "year": cmp = a.reportingYear.localeCompare(b.reportingYear); break;
        case "tool": cmp = a.authoringTool.localeCompare(b.authoringTool); break;
        case "vertical": cmp = a.vertical.localeCompare(b.vertical); break;
      }
      return legacySortAsc ? cmp : -cmp;
    });
    return rows;
  }, [legacyData, legacySortKey, legacySortAsc]);

  const sortedModernData = useMemo(() => {
    const rows = [...(modernData || [])];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (modernSortKey) {
        case "course": cmp = a.courseName.localeCompare(b.courseName); break;
        case "year": cmp = a.reportingYear.localeCompare(b.reportingYear); break;
        case "tool": cmp = a.authoringTool.localeCompare(b.authoringTool); break;
        case "vertical": cmp = a.vertical.localeCompare(b.vertical); break;
        case "type": cmp = a.courseType.localeCompare(b.courseType); break;
      }
      return modernSortAsc ? cmp : -cmp;
    });
    return rows;
  }, [modernData, modernSortKey, modernSortAsc]);

  const sortedTimeData = useMemo(() => {
    const rows = [...(timeData || [])];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (timeSortKey) {
        case "course": cmp = a.courseName.localeCompare(b.courseName); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "hours": cmp = a.hours - b.hours; break;
        case "user": cmp = a.userName.localeCompare(b.userName); break;
      }
      return timeSortAsc ? cmp : -cmp;
    });
    return rows;
  }, [timeData, timeSortKey, timeSortAsc]);

  const sortedSmeData = useMemo(() => {
    const rows = [...(smeData || [])];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (smeSortKey) {
        case "course": cmp = a.courseName.localeCompare(b.courseName); break;
        case "year": cmp = a.reportingYear.localeCompare(b.reportingYear); break;
        case "sme": cmp = a.sme.localeCompare(b.sme); break;
        case "id": cmp = a.instructionalDesigner.localeCompare(b.instructionalDesigner); break;
        case "hours": cmp = a.hoursWorked - b.hoursWorked; break;
        case "billed": cmp = a.amountBilled - b.amountBilled; break;
      }
      return smeSortAsc ? cmp : -cmp;
    });
    return rows;
  }, [smeData, smeSortKey, smeSortAsc]);

  const sortedHistory = useMemo(() => {
    const rows = [...history];
    rows.sort((a: any, b: any) => {
      let cmp = 0;
      switch (historySortKey) {
        case "file": cmp = String(a.file_name || "").localeCompare(String(b.file_name || "")); break;
        case "rows": cmp = Number(a.row_count || 0) - Number(b.row_count || 0); break;
        case "status": cmp = String(a.status || "").localeCompare(String(b.status || "")); break;
        case "date": cmp = String(a.created_at || "").localeCompare(String(b.created_at || "")); break;
      }
      return historySortAsc ? cmp : -cmp;
    });
    return rows;
  }, [history, historySortKey, historySortAsc]);

  useEffect(() => {
    if (hasReviewIssues) setReviewOpen(true);
  }, [hasReviewIssues]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">Import Legacy, Modern, Time Spent, and SME survey files into the shared analytics dataset. Review and correct only the current upload batch before import.</p>
        <p className="mt-2 text-sm text-muted-foreground">Dashboard summary charts read mostly from `projects`. Detail and team views such as `Projects`, `Development`, `External Teams`, and `Data Explorer` read from `time_entries`. SME charts read from `sme_collaboration_surveys`.</p>
      </div>

      {latestCompletedImport && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Last Completed Import</CardTitle>
            <p className="text-sm text-muted-foreground">Most recent shared dataset refresh recorded in upload history.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="font-medium">{new Date(latestCompletedImport.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Uploader</p>
              <p className="font-medium break-all">{latestImportUploader}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rows Imported</p>
              <p className="font-medium">{latestCompletedImport.row_count}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data Refreshed</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {latestImportDatasets.length > 0 ? latestImportDatasets.map((dataset) => (
                  <Badge key={dataset} variant="secondary">{formatDatasetLabel(dataset)}</Badge>
                )) : <span className="text-sm text-muted-foreground">Unknown</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload drop zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DropZone label="Legacy Course Data" description="Completed courses 2022–2025" fileName={legacyFile} count={legacyData?.length ?? null} onFile={handleLegacy} id="legacy-file-input" />
        <DropZone label="Modern Course Data" description="Completed courses 2026+" fileName={modernFile} count={modernData?.length ?? null} onFile={handleModern} id="modern-file-input" />
        <DropZone label="Time Spent Category Data" description="Granular time entries by category & user" fileName={timeFile} count={timeData?.length ?? null} onFile={handleTime} id="time-file-input" />
        <DropZone label="SME Data Report" description="SME and ID collaboration survey responses" fileName={smeFile} count={smeData?.length ?? null} onFile={handleSme} id="sme-file-input" />
      </div>

      {/* Current upload summary */}
      {matchInfo && hasAnything && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Current Upload Summary</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">These counts reflect the files currently loaded on this page. Importing will refresh the shared dataset for all users. Corrections below affect this batch only.</p>
            </div>
            <Button onClick={importData} disabled={importing || !hasAnything}>
              {importing ? "Importing…" : "Import All"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasCourseFilesLoaded && !timeData && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Course files will refresh summary charts driven by `projects`, but time-driven detail charts will stay unchanged until a Time Spent file is uploaded.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{matchInfo.legacyCount}</p>
                <p className="text-xs text-muted-foreground">Legacy Courses</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{matchInfo.modernCount}</p>
                <p className="text-xs text-muted-foreground">Modern Courses</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{matchInfo.timeUniqueCount}</p>
                <p className="text-xs text-muted-foreground">Time Spent Courses</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{matchInfo.smeEntryCount}</p>
                <p className="text-xs text-muted-foreground">Survey Rows</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{matchInfo.smeMatchedCount}</p>
                <p className="text-xs text-muted-foreground">Survey Matches</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{matchInfo.matched}</p>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{matchInfo.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{matchInfo.totalUnique}</p>
                <p className="text-xs text-muted-foreground">Total Unique</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasCourseFilesLoaded && (
        <Card>
          <CardHeader className="space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Dashboard Status Diagnostics</CardTitle>
              <p className="text-sm text-muted-foreground">
                Uses the same completion rule as the Dashboard donut: finalized statuses count as complete, including `Completed`, `Published`, `Ready for Loading`, and `Ready to Publish`.
              </p>
            </div>
            <div className="w-full max-w-[220px]">
              <Select value={statusDiagnosticYear} onValueChange={setStatusDiagnosticYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableStatusDiagnosticYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Upload Courses</p>
                <p className="text-2xl font-bold">{dashboardStatusDiagnostics.uploadTotal}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Upload Not Complete</p>
                <p className="text-2xl font-bold">{dashboardStatusDiagnostics.uploadIncomplete}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Persisted Courses</p>
                <p className="text-2xl font-bold">{dashboardStatusDiagnostics.persistedTotal}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Dashboard Not Complete</p>
                <p className="text-2xl font-bold">{dashboardStatusDiagnostics.dashboardDonutIncomplete}</p>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Upload Total</TableHead>
                    <TableHead>Upload Not Complete</TableHead>
                    <TableHead>Persisted Total</TableHead>
                    <TableHead>Persisted Not Complete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardStatusDiagnostics.comparisonRows.length > 0 ? dashboardStatusDiagnostics.comparisonRows.map((row) => (
                    <TableRow key={`${row.source}-${row.year}`}>
                      <TableCell className="font-medium capitalize">{row.source}</TableCell>
                      <TableCell>{row.year}</TableCell>
                      <TableCell>{row.uploadTotal}</TableCell>
                      <TableCell>{row.uploadIncomplete}</TableCell>
                      <TableCell>{row.persistedTotal}</TableCell>
                      <TableCell>{row.persistedIncomplete}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Load Legacy and/or Modern files to compare uploaded status counts against persisted projects.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-medium">Yearly Course Volume Comparison</p>
                <p className="text-sm text-muted-foreground">
                  Mirrors the Dashboard `Yearly Course Volume: Completed vs Active` chart using upload rows versus persisted `projects`.
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Upload Completed</TableHead>
                      <TableHead>Upload Active</TableHead>
                      <TableHead>Persisted Completed</TableHead>
                      <TableHead>Persisted Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardStatusDiagnostics.yearlyRows.length > 0 ? dashboardStatusDiagnostics.yearlyRows.map((row) => (
                      <TableRow key={`yearly-${row.year}`}>
                        <TableCell className="font-medium">{row.year}</TableCell>
                        <TableCell>{row.uploadCompleted}</TableCell>
                        <TableCell>{row.uploadActive}</TableCell>
                        <TableCell>{row.persistedCompleted}</TableCell>
                        <TableCell>{row.persistedActive}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No yearly comparison is available yet for the selected filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-medium">Raw Reporting Year Keys</p>
                <p className="text-sm text-muted-foreground">
                  Surfaces raw year values exactly as loaded or stored so values like `2026 Courses`, blank years, or malformed keys stand out.
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Raw Year</TableHead>
                      <TableHead>Normalized Year</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Finalized</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Malformed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawYearDiagnostics.length > 0 ? rawYearDiagnostics.map((row) => (
                      <TableRow key={`${row.source}-${row.rawYear}-${row.normalizedYear}`}>
                        <TableCell className="font-medium capitalize">{row.source}</TableCell>
                        <TableCell>{row.rawYear}</TableCell>
                        <TableCell>{row.normalizedYear}</TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell>{row.finalized}</TableCell>
                        <TableCell>{row.active}</TableCell>
                        <TableCell>{row.malformed ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No year-key diagnostics are available yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-medium">Persisted Projects by Year</p>
                <p className="text-sm text-muted-foreground">
                  Reconciles persisted `projects` by normalized year, including finalized vs active counts and raw status values present for each year.
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Finalized</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Statuses Present</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {persistedYearAudit.length > 0 ? persistedYearAudit.map((row) => (
                      <TableRow key={`persisted-year-${row.year}`}>
                        <TableCell className="font-medium">{row.year}</TableCell>
                        <TableCell>{row.total}</TableCell>
                        <TableCell>{row.finalized}</TableCell>
                        <TableCell>{row.active}</TableCell>
                        <TableCell>{row.statuses}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No persisted year audit is available yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-medium">Persisted 2026 Sample</p>
                <p className="text-sm text-muted-foreground">
                  Small sample of persisted rows currently landing in reporting year `2026`, including their raw status and finalized bucket result.
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Reporting Year</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Raw Status</TableHead>
                      <TableHead>Finalized</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {persisted2026Sample.length > 0 ? persisted2026Sample.map((row) => (
                      <TableRow key={`persisted-2026-${row.key}`}>
                        <TableCell className="font-medium">{row.courseName}</TableCell>
                        <TableCell>{row.rawYear || row.year}</TableCell>
                        <TableCell className="capitalize">{row.source}</TableCell>
                        <TableCell>{row.rawStatus || "(blank)"}</TableCell>
                        <TableCell>{row.isComplete ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No persisted 2026 rows were found with the current data.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-medium">Sample Mismatches</p>
                <p className="text-sm text-muted-foreground">
                  Missing rows, extra persisted rows, or statuses that land in a different completion bucket than the current upload.
                </p>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Raw Year</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Upload Status</TableHead>
                      <TableHead>Persisted Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardStatusDiagnostics.mismatchRows.length > 0 ? dashboardStatusDiagnostics.mismatchRows.slice(0, 12).map((row) => (
                      <TableRow key={`${row.key}-${row.issue}`}>
                        <TableCell className="font-medium">{row.courseName}</TableCell>
                        <TableCell>{row.year}</TableCell>
                        <TableCell>{row.rawYear}</TableCell>
                        <TableCell className="capitalize">{row.source}</TableCell>
                        <TableCell>{row.issue}</TableCell>
                        <TableCell>{row.uploadStatus}</TableCell>
                        <TableCell>{row.persistedStatus}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No mismatches found for the selected year filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {matchInfo && hasAnything && (
        <Collapsible open={reviewOpen} onOpenChange={setReviewOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Current Upload Review</CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">Available only for the active files loaded above. Upload History below is a record and cannot be edited here.</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${reviewOpen ? "rotate-180" : ""}`} />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant={blockingTimeRows.length + blockingSurveyRows.length > 0 ? "destructive" : "outline"}>
                    {blockingTimeRows.length + blockingSurveyRows.length} rows need fixes
                  </Badge>
                  <Badge variant={markedSurveyRows.length > 0 ? "secondary" : "outline"}>
                    {markedSurveyRows.length} survey no-match records retained
                  </Badge>
                  <Badge variant={warnings.length > 0 ? "secondary" : "outline"}>
                    {warnings.length} warning summaries
                  </Badge>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Time Rows Need Fixes</p>
                    <p className="text-2xl font-bold">{blockingTimeRows.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Zero-Hour Time Rows</p>
                    <p className="text-2xl font-bold">{timeIssueRows.filter((row) => row.entry.hours === 0).length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Survey Rows Need Fixes</p>
                    <p className="text-2xl font-bold">{blockingSurveyRows.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Survey No-Match Saved</p>
                    <p className="text-2xl font-bold">{markedSurveyRows.length}</p>
                  </div>
                </div>

                <Collapsible open={issueOpen.blocking} onOpenChange={(open) => setIssueOpen((current) => ({ ...current, blocking: open }))}>
                  <div className="rounded-md border">
                    <CollapsibleTrigger asChild>
                      <div className="flex cursor-pointer items-center justify-between p-4">
                        <div>
                          <p className="font-medium">Rows That Need Fixes</p>
                          <p className="text-sm text-muted-foreground">Rows that will not import cleanly until corrected or manually matched.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive">{blockingTimeRows.length + blockingSurveyRows.length}</Badge>
                          <ChevronDown className={`h-4 w-4 transition-transform ${issueOpen.blocking ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4 border-t p-4">
                        {warnings.length > 0 && (
                          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground space-y-1">
                            {warnings.map((warning, index) => <p key={index}>{warning}</p>)}
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="text-sm font-medium">Time Spent Data</p>
                          <p className="text-xs text-muted-foreground">Unmatched time rows, canceled projects, and remembered default project matches.</p>
                        </div>

                        {unmatchedTimeGroups.slice(0, showMore.blockingTime).map((group) => {
                          const isCanceled = canceledGroups.has(group.groupKey);
                          const wasAutoCanceled = autoCanceledGroups.has(group.groupKey);
                          const hasAutoOverride = autoTimeOverrideGroups.has(group.groupKey) && !!group.activeOverrideKey;
                          return (
                          <div key={`blocking-time-group-${group.groupKey}`} className={cn("rounded-md border p-3 space-y-3", isCanceled && "opacity-60")}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn("text-sm font-medium", isCanceled && "line-through")}>{group.rows.length} time rows for "{group.courseName}"</span>
                                {isCanceled ? (
                                  <Badge variant="secondary">Canceled Project</Badge>
                                ) : (
                                  <Badge variant="outline">No project matched this course name/date</Badge>
                                )}
                                {wasAutoCanceled && isCanceled && (
                                  <span className="text-xs text-muted-foreground italic">Previously marked as canceled</span>
                                )}
                                {hasAutoOverride && !isCanceled && (
                                  <span className="text-xs text-muted-foreground italic">Previous default project match applied</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`cancel-${group.groupKey}`}
                                  checked={isCanceled}
                                  onCheckedChange={() => toggleCanceledGroup(group.groupKey)}
                                />
                                <label htmlFor={`cancel-${group.groupKey}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                                  Canceled Project
                                </label>
                              </div>
                            </div>
                            {!isCanceled && (
                              <>
                            <p className="text-xs text-muted-foreground">
                              Apply one match here to update all {group.rows.length} rows for this course in the current upload batch.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Course Name</p>
                                <Input
                                  value={group.courseName}
                                  onChange={(e) => updateTimeEntries(group.rows.map((row) => row.index), () => ({ courseName: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Rows Included</p>
                                <div className="h-10 rounded-md border px-3 py-2 text-sm bg-muted/30 flex items-center">
                                  {group.rows.length} rows
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Sample Dates</p>
                                <div className="h-10 rounded-md border px-3 py-2 text-sm bg-muted/30 flex items-center truncate">
                                  {group.datePreview || "No dates"}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Apply Suggested Match to All Rows</p>
                                <SearchableProjectSelect
                                  options={group.suggestedCandidates}
                                  value={group.activeOverrideKey}
                                  placeholder={group.suggestedCandidates.length ? "Choose a likely match" : "No same-name suggestions"}
                                  emptyLabel="No matching projects found."
                                  onChange={(value) => {
                                    const selected = group.suggestedCandidates.find((candidate) => candidate.key === value);
                                    if (!selected) return;
                                    const indexes = group.rows.map((row) => row.index);
                                    setTimeOverrides(indexes, selected.key);
                                    updateTimeEntries(indexes, (entry) => ({
                                      courseName: selected.name,
                                      date: replaceDateYear(entry.date, selected.reportingYear),
                                    }));
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Force Match All Rows to Any Project</p>
                                <SearchableProjectSelect
                                  options={group.forceCandidates}
                                  value={group.activeOverrideKey}
                                  placeholder={group.activeOverrideKey ? `Override active for ${group.rows.length} rows` : "Choose any project"}
                                  emptyLabel="No projects available."
                                  onChange={(value) => setTimeOverrides(group.rows.map((row) => row.index), value)}
                                />
                              </div>
                            </div>
                            {group.activeOverrideKey && (
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-primary">
                                  {hasAutoOverride ? "Saved default project match is active for this group." : "Manual override is active for all rows in this course group."}
                                </p>
                                <Button variant="outline" size="sm" onClick={() => setTimeOverrides(group.rows.map((row) => row.index), undefined)}>Clear override for group</Button>
                              </div>
                            )}
                              </>
                            )}
                            {isCanceled && (
                              <p className="text-xs text-muted-foreground">
                                These {group.rows.length} time entries will be skipped during import.
                              </p>
                            )}
                          </div>
                          );
                        })}

                        {individualBlockingTimeRows.slice(0, showMore.blockingTime).map((row) => (
                          <div key={`blocking-time-${row.index}`} className="rounded-md border p-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">Time row #{row.index + 1}</span>
                              {row.blockingReasons.map((reason) => <Badge key={reason} variant="outline">{reason}</Badge>)}
                            </div>
                            <p className="text-xs text-muted-foreground">{describeTimeResolution(row.resolved.reason)}</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Course Name</p>
                                <Input value={row.entry.courseName} onChange={(e) => updateTimeEntry(row.index, { courseName: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Date</p>
                                <Input value={row.entry.date} onChange={(e) => updateTimeEntry(row.index, { date: e.target.value })} placeholder="YYYY-MM-DD" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Hours</p>
                                <Input value={String(row.entry.hours)} onChange={(e) => updateTimeEntry(row.index, { hours: Number.parseFloat(e.target.value) || 0 })} />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Apply Suggested Match</p>
                                <SearchableProjectSelect
                                  options={row.suggestedCandidates}
                                  value={timeOverrideKeys[row.index]}
                                  placeholder={row.suggestedCandidates.length ? "Choose a likely match" : "No same-name suggestions"}
                                  emptyLabel="No matching projects found."
                                  onChange={(value) => {
                                    const selected = row.suggestedCandidates.find((candidate) => candidate.key === value);
                                    if (!selected) return;
                                    setTimeOverride(row.index, selected.key);
                                    updateTimeEntry(row.index, {
                                      courseName: selected.name,
                                      date: replaceDateYear(row.entry.date, selected.reportingYear),
                                    });
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Force Match to Any Project</p>
                                <SearchableProjectSelect
                                  options={row.forceCandidates}
                                  value={timeOverrideKeys[row.index]}
                                  placeholder={timeOverrideKeys[row.index] ? `Override active: ${timeOverrideKeys[row.index]}` : "Choose any project"}
                                  emptyLabel="No projects available."
                                  onChange={(value) => setTimeOverride(row.index, value)}
                                />
                              </div>
                            </div>
                            {timeOverrideKeys[row.index] && (
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-primary">Manual override is active for this row.</p>
                                <Button variant="outline" size="sm" onClick={() => setTimeOverride(row.index, undefined)}>Clear override</Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {unmatchedTimeGroups.length + individualBlockingTimeRows.length > showMore.blockingTime && (
                          <Button variant="outline" onClick={() => setShowMore((current) => ({ ...current, blockingTime: current.blockingTime + 10 }))}>
                            Show More Time Fixes
                          </Button>
                        )}

                        <div className="space-y-1 pt-2">
                          <p className="text-sm font-medium">SME Survey Data</p>
                          <p className="text-xs text-muted-foreground">Match survey rows to projects or mark that no project match exists so the app remembers that decision.</p>
                        </div>

                        {blockingSurveyRows.slice(0, showMore.blockingSurvey).map((row) => (
                          <div key={`blocking-survey-${row.index}`} className="rounded-md border p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">Survey row #{row.index + 1}</span>
                                {row.blockingReasons.map((reason) => <Badge key={reason} variant="outline">{reason}</Badge>)}
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`survey-no-match-${row.index}`}
                                  checked={surveyNoMatchKeys.has(row.matchKey)}
                                  onCheckedChange={() => toggleSurveyNoMatchKey(row.matchKey)}
                                />
                                <label htmlFor={`survey-no-match-${row.index}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                                  No Match Exists
                                </label>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{describeSurveyResolution(row.resolved.reason)}</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Course Name</p>
                                <Input value={row.entry.courseName} onChange={(e) => updateSmeEntry(row.index, { courseName: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Year</p>
                                <Input value={row.entry.reportingYear} onChange={(e) => updateSmeEntry(row.index, { reportingYear: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Hours Worked</p>
                                <Input value={String(row.entry.hoursWorked)} onChange={(e) => updateSmeEntry(row.index, { hoursWorked: Number.parseFloat(e.target.value) || 0 })} />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Apply Suggested Match</p>
                                <SearchableProjectSelect
                                  options={row.suggestedCandidates}
                                  value={surveyOverrideKeys[row.index]}
                                  placeholder={row.suggestedCandidates.length ? "Choose a likely match" : "No same-name suggestions"}
                                  emptyLabel="No matching projects found."
                                  onChange={(value) => {
                                    const selected = row.suggestedCandidates.find((candidate) => candidate.key === value);
                                    if (!selected) return;
                                    setSurveyOverride(row.index, selected.key);
                                    updateSmeEntry(row.index, { courseName: selected.name, reportingYear: selected.reportingYear });
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Force Match to Any Project</p>
                                <SearchableProjectSelect
                                  options={row.forceCandidates}
                                  value={surveyOverrideKeys[row.index]}
                                  placeholder={surveyOverrideKeys[row.index] ? `Override active: ${surveyOverrideKeys[row.index]}` : "Choose any project"}
                                  emptyLabel="No projects available."
                                  onChange={(value) => setSurveyOverride(row.index, value)}
                                />
                              </div>
                            </div>
                            {surveyOverrideKeys[row.index] && (
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-primary">Manual override is active for this row.</p>
                                <Button variant="outline" size="sm" onClick={() => setSurveyOverride(row.index, undefined)}>Clear override</Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {markedSurveyRows.slice(0, showMore.blockingSurvey).map((row) => {
                          const wasAutoMarked = autoSurveyNoMatchKeys.has(row.matchKey);
                          return (
                            <div key={`marked-survey-${row.index}`} className="rounded-md border p-3 space-y-3 opacity-80">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium">Survey row #{row.index + 1}</span>
                                  <Badge variant="secondary">No Match Exists</Badge>
                                  {wasAutoMarked && (
                                    <span className="text-xs text-muted-foreground italic">Previously retained</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`survey-no-match-${row.index}`}
                                    checked
                                    onCheckedChange={() => toggleSurveyNoMatchKey(row.matchKey)}
                                  />
                                  <label htmlFor={`survey-no-match-${row.index}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                                    No Match Exists
                                  </label>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">This survey row will remain in app-level survey views without linking to a project.</p>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">Course Name</p>
                                  <Input value={row.entry.courseName} onChange={(e) => updateSmeEntry(row.index, { courseName: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">Year</p>
                                  <Input value={row.entry.reportingYear} onChange={(e) => updateSmeEntry(row.index, { reportingYear: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">Hours Worked</p>
                                  <Input value={String(row.entry.hoursWorked)} onChange={(e) => updateSmeEntry(row.index, { hoursWorked: Number.parseFloat(e.target.value) || 0 })} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {blockingSurveyRows.length > showMore.blockingSurvey && (
                          <Button variant="outline" onClick={() => setShowMore((current) => ({ ...current, blockingSurvey: current.blockingSurvey + 10 }))}>
                            Show More Survey Fixes
                          </Button>
                        )}

                        {blockingTimeRows.length === 0 && blockingSurveyRows.length === 0 && markedSurveyRows.length === 0 && (
                          <p className="text-sm text-muted-foreground">No blocking issues in the current upload.</p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Preview tables */}
      {legacyData && legacyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{legacyFile} — {legacyData.length} courses</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (legacySortKey === "course") setLegacySortAsc((v) => !v);
                    else { setLegacySortKey("course"); setLegacySortAsc(true); }
                  }}><span className="flex items-center gap-1">Course <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (legacySortKey === "hours") setLegacySortAsc((v) => !v);
                    else { setLegacySortKey("hours"); setLegacySortAsc(true); }
                  }}><span className="flex items-center gap-1">Hours <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (legacySortKey === "year") setLegacySortAsc((v) => !v);
                    else { setLegacySortKey("year"); setLegacySortAsc(true); }
                  }}><span className="flex items-center gap-1">Year <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (legacySortKey === "tool") setLegacySortAsc((v) => !v);
                    else { setLegacySortKey("tool"); setLegacySortAsc(true); }
                  }}><span className="flex items-center gap-1">Tool <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (legacySortKey === "vertical") setLegacySortAsc((v) => !v);
                    else { setLegacySortKey("vertical"); setLegacySortAsc(true); }
                  }}><span className="flex items-center gap-1">Vertical <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedLegacyData.slice(0, 20).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.courseName}</TableCell>
                      <TableCell>{Math.round(c.totalHours * 100) / 100}</TableCell>
                      <TableCell>{c.reportingYear}</TableCell>
                      <TableCell>{c.authoringTool}</TableCell>
                      <TableCell>{c.vertical}</TableCell>
                    </TableRow>
                  ))}
                  {sortedLegacyData.length > 20 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">…and {sortedLegacyData.length - 20} more</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {modernData && modernData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{modernFile} — {modernData.length} courses</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (modernSortKey === "course") setModernSortAsc((v) => !v);
                    else { setModernSortKey("course"); setModernSortAsc(true); }
                  }}><span className="flex items-center gap-1">Course <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (modernSortKey === "year") setModernSortAsc((v) => !v);
                    else { setModernSortKey("year"); setModernSortAsc(true); }
                  }}><span className="flex items-center gap-1">Year <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (modernSortKey === "tool") setModernSortAsc((v) => !v);
                    else { setModernSortKey("tool"); setModernSortAsc(true); }
                  }}><span className="flex items-center gap-1">Tool <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (modernSortKey === "vertical") setModernSortAsc((v) => !v);
                    else { setModernSortKey("vertical"); setModernSortAsc(true); }
                  }}><span className="flex items-center gap-1">Vertical <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (modernSortKey === "type") setModernSortAsc((v) => !v);
                    else { setModernSortKey("type"); setModernSortAsc(true); }
                  }}><span className="flex items-center gap-1">Type <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedModernData.slice(0, 20).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.courseName}</TableCell>
                      <TableCell>{c.reportingYear}</TableCell>
                      <TableCell>{c.authoringTool}</TableCell>
                      <TableCell>{c.vertical}</TableCell>
                      <TableCell>{c.courseType}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {timeData && timeData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{timeFile} — {timeData.length} entries</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (timeSortKey === "course") setTimeSortAsc((v) => !v);
                    else { setTimeSortKey("course"); setTimeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Course <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (timeSortKey === "category") setTimeSortAsc((v) => !v);
                    else { setTimeSortKey("category"); setTimeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Category <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (timeSortKey === "date") setTimeSortAsc((v) => !v);
                    else { setTimeSortKey("date"); setTimeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (timeSortKey === "hours") setTimeSortAsc((v) => !v);
                    else { setTimeSortKey("hours"); setTimeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Hours <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (timeSortKey === "user") setTimeSortAsc((v) => !v);
                    else { setTimeSortKey("user"); setTimeSortAsc(true); }
                  }}><span className="flex items-center gap-1">User <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedTimeData.slice(0, 20).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{e.courseName}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell>{e.date}</TableCell>
                      <TableCell>{Math.round(e.hours * 100) / 100}</TableCell>
                      <TableCell>{e.userName}</TableCell>
                    </TableRow>
                  ))}
                  {sortedTimeData.length > 20 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">…and {sortedTimeData.length - 20} more</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {smeData && smeData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{smeFile} — {smeData.length} survey rows</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (smeSortKey === "course") setSmeSortAsc((v) => !v);
                    else { setSmeSortKey("course"); setSmeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Course <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (smeSortKey === "year") setSmeSortAsc((v) => !v);
                    else { setSmeSortKey("year"); setSmeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Year <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (smeSortKey === "sme") setSmeSortAsc((v) => !v);
                    else { setSmeSortKey("sme"); setSmeSortAsc(true); }
                  }}><span className="flex items-center gap-1">SME <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (smeSortKey === "id") setSmeSortAsc((v) => !v);
                    else { setSmeSortKey("id"); setSmeSortAsc(true); }
                  }}><span className="flex items-center gap-1">ID <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (smeSortKey === "hours") setSmeSortAsc((v) => !v);
                    else { setSmeSortKey("hours"); setSmeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Hours <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => {
                    if (smeSortKey === "billed") setSmeSortAsc((v) => !v);
                    else { setSmeSortKey("billed"); setSmeSortAsc(true); }
                  }}><span className="flex items-center gap-1">Billed <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {sortedSmeData.slice(0, 20).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{e.courseName}</TableCell>
                      <TableCell>{e.reportingYear}</TableCell>
                      <TableCell>{e.sme}</TableCell>
                      <TableCell>{e.instructionalDesigner}</TableCell>
                      <TableCell>{Math.round(e.hoursWorked * 100) / 100}</TableCell>
                      <TableCell>${Math.round(e.amountBilled * 100) / 100}</TableCell>
                    </TableRow>
                  ))}
                  {sortedSmeData.length > 20 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">…and {sortedSmeData.length - 20} more</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload History */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Upload History</CardTitle>
            <p className="text-sm text-muted-foreground">Read-only log of completed imports. Cleanup tools above only apply to the current upload batch before import.</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => {
                  if (historySortKey === "file") setHistorySortAsc((v) => !v);
                  else { setHistorySortKey("file"); setHistorySortAsc(true); }
                }}><span className="flex items-center gap-1">File <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => {
                  if (historySortKey === "rows") setHistorySortAsc((v) => !v);
                  else { setHistorySortKey("rows"); setHistorySortAsc(true); }
                }}><span className="flex items-center gap-1">Rows <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => {
                  if (historySortKey === "status") setHistorySortAsc((v) => !v);
                  else { setHistorySortKey("status"); setHistorySortAsc(true); }
                }}><span className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => {
                  if (historySortKey === "date") setHistorySortAsc((v) => !v);
                  else { setHistorySortKey("date"); setHistorySortAsc(true); }
                }}><span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                <TableHead>Data Refreshed</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sortedHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.file_name}</TableCell>
                    <TableCell>{h.row_count}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        {h.status === "completed" ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Completed</>
                        ) : (
                          <><AlertCircle className="h-3.5 w-3.5 text-destructive" /> {h.status}</>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(h.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {parseDatasetType(h.dataset_type).map((dataset) => (
                          <Badge key={`${h.id}-${dataset}`} variant="outline">{formatDatasetLabel(dataset)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
