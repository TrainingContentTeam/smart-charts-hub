import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Link2, ChevronDown, ArrowUpDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { parseLegacyCourseFile, type LegacyCourse } from "@/lib/parse-legacy-course";
import { parseModernCourseFile, type ModernCourse } from "@/lib/parse-modern-course";
import { parseTimeSpentFile, type TimeSpentEntry } from "@/lib/parse-time-spent";
import { makeId, readLocalStore, writeLocalStore } from "@/lib/local-data-store";
import { normalizeProjectStatus } from "@/lib/project-status";
import { supabase } from "@/integrations/supabase/client";
import { useUploadHistory } from "@/hooks/use-time-data";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface DropZoneProps {
  label: string;
  description: string;
  fileName: string;
  count: number | null;
  onFile: (file: File) => void;
  id: string;
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
  | "fallback_latest";

type ResolveResult = {
  key: string | null;
  reason: ResolveReason;
};

function resolveProjectKeyForTimeEntry(entry: TimeSpentEntry, byName: Map<string, ProjectCandidate[]>): ResolveResult {
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

export default function UploadData() {
  const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
  const [legacyFile, setLegacyFile] = useState("");
  const [modernFile, setModernFile] = useState("");
  const [timeFile, setTimeFile] = useState("");
  const [legacyData, setLegacyData] = useState<LegacyCourse[] | null>(null);
  const [modernData, setModernData] = useState<ModernCourse[] | null>(null);
  const [timeData, setTimeData] = useState<TimeSpentEntry[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [legacySortKey, setLegacySortKey] = useState<"course" | "hours" | "year" | "tool" | "vertical">("course");
  const [legacySortAsc, setLegacySortAsc] = useState(true);
  const [modernSortKey, setModernSortKey] = useState<"course" | "year" | "tool" | "vertical" | "type">("course");
  const [modernSortAsc, setModernSortAsc] = useState(true);
  const [timeSortKey, setTimeSortKey] = useState<"course" | "category" | "date" | "hours" | "user">("date");
  const [timeSortAsc, setTimeSortAsc] = useState(false);
  const [historySortKey, setHistorySortKey] = useState<"file" | "rows" | "status" | "date">("date");
  const [historySortAsc, setHistorySortAsc] = useState(false);
  const [ambigSortKey, setAmbigSortKey] = useState<"course" | "variants" | "timeRows" | "undated" | "years">("timeRows");
  const [ambigSortAsc, setAmbigSortAsc] = useState(false);
  const { data: history = [] } = useUploadHistory();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleLegacy = useCallback(async (file: File) => {
    setLegacyFile(file.name);
    try {
      const data = await parseLegacyCourseFile(file);
      setLegacyData(data);
      if (data.length === 0) toast.warning("No legacy course entries found.");
    } catch { toast.error("Failed to parse legacy course file."); }
  }, []);

  const handleModern = useCallback(async (file: File) => {
    setModernFile(file.name);
    try {
      const data = await parseModernCourseFile(file);
      setModernData(data);
      if (data.length === 0) toast.warning("No modern course entries found.");
    } catch { toast.error("Failed to parse modern course file."); }
  }, []);

  const handleTime = useCallback(async (file: File) => {
    setTimeFile(file.name);
    try {
      const data = await parseTimeSpentFile(file);
      setTimeData(data);
      if (data.length === 0) toast.warning("No time spent entries found.");
    } catch { toast.error("Failed to parse time spent file."); }
  }, []);

  // Match preview
  const matchInfo = useMemo(() => {
    if (!legacyData && !modernData && !timeData) return null;
    const legacyNames = new Set((legacyData || []).map(c => normKey(c.courseName)));
    const modernNames = new Set((modernData || []).map(c => normKey(c.courseName)));
    const timeNames = new Set((timeData || []).map(e => normKey(e.courseName)));
    const allCourseNames = new Set([...legacyNames, ...modernNames]);
    const inProgress = [...timeNames].filter(n => !allCourseNames.has(n));
    const matched = [...allCourseNames].filter(n => timeNames.has(n));
    const warn: string[] = [];
    // Zero-hour entries
    const zeroHour = (timeData || []).filter(e => e.hours === 0);
    if (zeroHour.length > 0) warn.push(`${zeroHour.length} time entries with zero hours`);
    // Unmatched courses (in legacy/modern but not in time spent)
    const unmatched = [...allCourseNames].filter(n => !timeNames.has(n));
    if (unmatched.length > 0) warn.push(`${unmatched.length} courses with no time entries`);
    setWarnings(warn);
    return {
      legacyCount: legacyData?.length || 0,
      modernCount: modernData?.length || 0,
      timeUniqueCount: timeNames.size,
      timeEntryCount: timeData?.length || 0,
      matched: matched.length,
      inProgress: inProgress.length,
      totalUnique: new Set([...allCourseNames, ...timeNames]).size,
    };
  }, [legacyData, modernData, timeData]);

  const ambiguityDiagnostics = useMemo(() => {
    const byName = new Map<string, { name: string; source: string; reportingYear: string }[]>();

    (legacyData || []).forEach((c) => {
      const key = normKey(c.courseName);
      const list = byName.get(key) || [];
      list.push({ name: c.courseName, source: "legacy", reportingYear: c.reportingYear || "" });
      byName.set(key, list);
    });

    (modernData || []).forEach((c) => {
      const key = normKey(c.courseName);
      const list = byName.get(key) || [];
      list.push({ name: c.courseName, source: "modern", reportingYear: c.reportingYear || "" });
      byName.set(key, list);
    });

    const rows = [...byName.entries()]
      .filter(([, variants]) => variants.length > 1)
      .map(([nameKey, variants]) => {
        const entriesForName = (timeData || []).filter((e) => normKey(e.courseName) === nameKey);
        let undatedRows = 0;
        const years = new Set<string>();
        entriesForName.forEach((e) => {
          const y = parseEntryYear(e.date);
          if (y === null) undatedRows += 1;
          else years.add(String(y));
        });

        const variantSummary = variants
          .map((v) => `${v.source}:${v.reportingYear || "unknown"}`)
          .join(", ");

        return {
          courseName: variants[0].name,
          variantSummary,
          variantCount: variants.length,
          timeRows: entriesForName.length,
          undatedRows,
          years: [...years].sort().join(", "),
        };
      })
      .sort((a, b) => b.timeRows - a.timeRows || a.courseName.localeCompare(b.courseName));

    return {
      totalAmbiguousTitles: rows.length,
      totalUndatedRows: rows.reduce((s, r) => s + r.undatedRows, 0),
      rows,
    };
  }, [legacyData, modernData, timeData]);

  const importData = async () => {
    if (!legacyData && !modernData && !timeData) return;
    setImporting(true);
    try {
      const totalRows = (legacyData?.length || 0) + (modernData?.length || 0) + (timeData?.length || 0);
      const combinedFileName = [legacyFile, modernFile, timeFile].filter(Boolean).join(" + ");

      if (DEV_BYPASS_AUTH) {
        const now = new Date().toISOString();
        const uploadId = makeId();
        const local = readLocalStore();
        const existingProjects = [...local.projects];
        const existingMap = new Map(existingProjects.map((p) => [courseKey(p.name, p.reporting_year), p]));

        // Build course index with composite key: Course Name + Reporting Year
        const legacyMap = new Map<string, LegacyCourse>();
        (legacyData || []).forEach(c => legacyMap.set(courseKey(c.courseName, c.reportingYear), c));

        const modernMap = new Map<string, ModernCourse>();
        (modernData || []).forEach(c => modernMap.set(courseKey(c.courseName, c.reportingYear), c));

        const projectIdMap = new Map<string, string>();
        const projectCandidatesByName = new Map<string, ProjectCandidate[]>();
        const allCourseKeys = new Set([
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
            status = normalizeProjectStatus(legacy.status, existing ? String((existing as any).status || "") : "In Progress");
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
              interaction_count: legacy.interactionCount,
              reporting_year: legacy.reportingYear,
            };
          } else if (modern) {
            status = normalizeProjectStatus(modern.status, existing ? String((existing as any).status || "") : "In Progress");
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

        let timeCount = 0;
        let unresolvedCount = 0;
        let fallbackCount = 0;
        let sourceHintCount = 0;
        const localTimeEntries = [...local.time_entries];
        if (timeData && timeData.length > 0) {
          for (const e of timeData) {
            const resolved = resolveProjectKeyForTimeEntry(e, projectCandidatesByName);
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

        const uploadHistory = [
          {
            id: uploadId,
            file_name: combinedFileName,
            row_count: totalRows,
            status: "completed",
            user_id: user?.id,
            created_at: now,
          },
          ...local.upload_history,
        ];

        writeLocalStore({
          projects: existingProjects as any,
          time_entries: localTimeEntries as any,
          upload_history: uploadHistory as any,
        });

        toast.success(`Imported ${allCourseKeys.size} courses, ${timeCount} category time entries.`);
        if (unresolvedCount > 0) {
          toast.warning(`${unresolvedCount} time entries could not be matched to a project.`);
        }
        if (fallbackCount > 0) {
          toast.warning(`${fallbackCount} time entries used fallback mapping on duplicate course titles.`);
        }
        if (sourceHintCount > 0) {
          toast.message(`${sourceHintCount} time entries were disambiguated by date-year source hint.`);
        }
        setLegacyData(null); setModernData(null); setTimeData(null);
        setLegacyFile(""); setModernFile(""); setTimeFile("");
        setWarnings([]);
        queryClient.invalidateQueries({ queryKey: ["time_entries"] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["upload_history"] });
        return;
      }

      // Upload history
      const { data: upload, error: uploadErr } = await supabase
        .from("upload_history")
        .insert({ file_name: combinedFileName, row_count: totalRows, user_id: user!.id })
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

      // Upsert projects
      const projectIdMap = new Map<string, string>();
      const projectCandidatesByName = new Map<string, ProjectCandidate[]>();
      const allCourseKeys = new Set([
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
          status = normalizeProjectStatus(legacy.status, existing ? String(existing.status || "") : "In Progress");
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
            interaction_count: legacy.interactionCount,
            reporting_year: legacy.reportingYear,
          };
        } else if (modern) {
          status = normalizeProjectStatus(modern.status, existing ? String(existing.status || "") : "In Progress");
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

      // Insert time entries from Time Spent file
      let timeCount = 0;
      let unresolvedCount = 0;
      let fallbackCount = 0;
      let sourceHintCount = 0;
      if (timeData && timeData.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < timeData.length; i += batchSize) {
          const batch = timeData.slice(i, i + batchSize).map(e => {
            const resolved = resolveProjectKeyForTimeEntry(e, projectCandidatesByName);
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
          };});
          const { error: entryErr } = await supabase.from("time_entries").insert(batch as any);
          if (entryErr) throw entryErr;
          timeCount += batch.length;
        }
      }

      toast.success(
        `Imported ${allCourseKeys.size} courses, ${timeCount} category time entries.`
      );
      if (unresolvedCount > 0) {
        toast.warning(`${unresolvedCount} time entries could not be matched to a project.`);
      }
      if (fallbackCount > 0) {
        toast.warning(`${fallbackCount} time entries used fallback mapping on duplicate course titles.`);
      }
      if (sourceHintCount > 0) {
        toast.message(`${sourceHintCount} time entries were disambiguated by date-year source hint.`);
      }
      setLegacyData(null); setModernData(null); setTimeData(null);
      setLegacyFile(""); setModernFile(""); setTimeFile("");
      setWarnings([]);
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["upload_history"] });
    } catch (err: any) {
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const hasAnything = legacyData || modernData || timeData;

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

  const sortedAmbiguityRows = useMemo(() => {
    const rows = [...ambiguityDiagnostics.rows];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (ambigSortKey) {
        case "course": cmp = a.courseName.localeCompare(b.courseName); break;
        case "variants": cmp = a.variantSummary.localeCompare(b.variantSummary); break;
        case "timeRows": cmp = a.timeRows - b.timeRows; break;
        case "undated": cmp = a.undatedRows - b.undatedRows; break;
        case "years": cmp = a.years.localeCompare(b.years); break;
      }
      return ambigSortAsc ? cmp : -cmp;
    });
    return rows;
  }, [ambiguityDiagnostics.rows, ambigSortKey, ambigSortAsc]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">Import Legacy, Modern, and Time Spent CSV files</p>
      </div>

      {/* Three drop zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DropZone label="Legacy Course Data" description="Completed courses 2022–2025" fileName={legacyFile} count={legacyData?.length ?? null} onFile={handleLegacy} id="legacy-file-input" />
        <DropZone label="Modern Course Data" description="Completed courses 2026+" fileName={modernFile} count={modernData?.length ?? null} onFile={handleModern} id="modern-file-input" />
        <DropZone label="Time Spent Category Data" description="Granular time entries by category & user" fileName={timeFile} count={timeData?.length ?? null} onFile={handleTime} id="time-file-input" />
      </div>

      {/* Match Preview */}
      {matchInfo && hasAnything && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Match Preview</CardTitle>
            </div>
            <Button onClick={importData} disabled={importing || !hasAnything}>
              {importing ? "Importing…" : "Import All"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
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

            {warnings.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <AlertCircle className="h-4 w-4" />
                  {warnings.length} validation warning(s)
                  <ChevronDown className="h-3 w-3" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-sm text-muted-foreground">• {w}</p>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {ambiguityDiagnostics.totalAmbiguousTitles > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <AlertCircle className="h-4 w-4" />
                  {ambiguityDiagnostics.totalAmbiguousTitles} duplicate title group(s) detected
                  <ChevronDown className="h-3 w-3" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Undated rows inside duplicate title groups: {ambiguityDiagnostics.totalUndatedRows}
                  </p>
                  <div className="max-h-[220px] overflow-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer select-none" onClick={() => {
                            if (ambigSortKey === "course") setAmbigSortAsc((v) => !v);
                            else { setAmbigSortKey("course"); setAmbigSortAsc(true); }
                          }}><span className="flex items-center gap-1">Course <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => {
                            if (ambigSortKey === "variants") setAmbigSortAsc((v) => !v);
                            else { setAmbigSortKey("variants"); setAmbigSortAsc(true); }
                          }}><span className="flex items-center gap-1">Variants <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => {
                            if (ambigSortKey === "timeRows") setAmbigSortAsc((v) => !v);
                            else { setAmbigSortKey("timeRows"); setAmbigSortAsc(true); }
                          }}><span className="flex items-center gap-1">Time Rows <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => {
                            if (ambigSortKey === "undated") setAmbigSortAsc((v) => !v);
                            else { setAmbigSortKey("undated"); setAmbigSortAsc(true); }
                          }}><span className="flex items-center gap-1">Undated <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => {
                            if (ambigSortKey === "years") setAmbigSortAsc((v) => !v);
                            else { setAmbigSortKey("years"); setAmbigSortAsc(true); }
                          }}><span className="flex items-center gap-1">Entry Years <ArrowUpDown className="h-3 w-3" /></span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedAmbiguityRows.map((r, i) => (
                          <TableRow key={`${r.courseName}-${i}`}>
                            <TableCell className="font-medium">{r.courseName}</TableCell>
                            <TableCell>{r.variantSummary}</TableCell>
                            <TableCell>{r.timeRows}</TableCell>
                            <TableCell>{r.undatedRows}</TableCell>
                            <TableCell>{r.years || "none"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
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

      {/* Upload History */}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload History</CardTitle></CardHeader>
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
