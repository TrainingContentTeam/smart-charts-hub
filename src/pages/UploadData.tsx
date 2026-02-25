import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Link2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { parseLegacyCourseFile, type LegacyCourse } from "@/lib/parse-legacy-course";
import { parseModernCourseFile, type ModernCourse } from "@/lib/parse-modern-course";
import { parseTimeSpentFile, type TimeSpentEntry } from "@/lib/parse-time-spent";
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

export default function UploadData() {
  const [legacyFile, setLegacyFile] = useState("");
  const [modernFile, setModernFile] = useState("");
  const [timeFile, setTimeFile] = useState("");
  const [legacyData, setLegacyData] = useState<LegacyCourse[] | null>(null);
  const [modernData, setModernData] = useState<ModernCourse[] | null>(null);
  const [timeData, setTimeData] = useState<TimeSpentEntry[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
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

  const importData = async () => {
    if (!legacyData && !modernData && !timeData) return;
    setImporting(true);
    try {
      const totalRows = (legacyData?.length || 0) + (modernData?.length || 0) + (timeData?.length || 0);
      const combinedFileName = [legacyFile, modernFile, timeFile].filter(Boolean).join(" + ");

      // Upload history
      const { data: upload, error: uploadErr } = await supabase
        .from("upload_history")
        .insert({ file_name: combinedFileName, row_count: totalRows, user_id: user!.id })
        .select()
        .single();
      if (uploadErr) throw uploadErr;

      // Build course index
      const legacyMap = new Map<string, LegacyCourse>();
      (legacyData || []).forEach(c => legacyMap.set(normKey(c.courseName), c));

      const modernMap = new Map<string, ModernCourse>();
      (modernData || []).forEach(c => modernMap.set(normKey(c.courseName), c));

      // Aggregate time spent per course
      const timeAgg = new Map<string, number>();
      (timeData || []).forEach(e => {
        const k = normKey(e.courseName);
        timeAgg.set(k, (timeAgg.get(k) || 0) + e.hours);
      });

      // All unique course names
      const allNames = new Set([...legacyMap.keys(), ...modernMap.keys(), ...timeAgg.keys()]);

      // Get existing projects
      const existingProjects = (await supabase.from("projects").select("*")).data || [];
      const existingMap = new Map(existingProjects.map((p: any) => [normKey(p.name), p]));

      // Upsert projects
      const projectIdMap = new Map<string, string>();

      for (const key of allNames) {
        const legacy = legacyMap.get(key);
        const modern = modernMap.get(key);
        const existing = existingMap.get(key);

        let status: string;
        let totalHours: number;
        let dataSource: string;
        let meta: any = {};

        if (legacy) {
          // Case A: Legacy
          status = "Completed";
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
          // Case B: Modern
          status = "Completed";
          totalHours = timeAgg.get(key) || 0;
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
          // Case C: In Progress
          status = "In Progress";
          totalHours = timeAgg.get(key) || 0;
          dataSource = "time_only";
        }

        // Get display name from original data
        const displayName = legacy?.courseName || modern?.courseName ||
          (timeData || []).find(e => normKey(e.courseName) === key)?.courseName || key;

        if (existing) {
          await supabase
            .from("projects")
            .update({ status, total_hours: totalHours, data_source: dataSource, user_id: user!.id, ...meta } as any)
            .eq("id", existing.id);
          projectIdMap.set(key, existing.id);
        } else {
          const { data: inserted } = await supabase
            .from("projects")
            .insert({ name: displayName, status, total_hours: totalHours, data_source: dataSource, user_id: user!.id, ...meta } as any)
            .select()
            .single();
          if (inserted) {
            projectIdMap.set(key, inserted.id);
            existingMap.set(key, inserted);
          }
        }
      }

      // Insert time entries from Time Spent file
      let timeCount = 0;
      if (timeData && timeData.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < timeData.length; i += batchSize) {
          const batch = timeData.slice(i, i + batchSize).map(e => ({
            project_id: projectIdMap.get(normKey(e.courseName)) || null,
            phase: e.category || "Uncategorized",
            hours: e.hours,
            category: e.category,
            entry_date: e.date || null,
            user_name: e.userName,
            upload_id: upload.id,
            user_id: user!.id,
          }));
          const { error: entryErr } = await supabase.from("time_entries").insert(batch as any);
          if (entryErr) throw entryErr;
          timeCount += batch.length;
        }
      }

      // For Legacy courses, insert a single summary time_entry
      if (legacyData && legacyData.length > 0) {
        const legacySummaries = legacyData.map(c => ({
          project_id: projectIdMap.get(normKey(c.courseName)) || null,
          phase: "Total",
          hours: c.totalHours,
          category: "Total",
          upload_id: upload.id,
          user_id: user!.id,
        }));
        const batchSize = 500;
        for (let i = 0; i < legacySummaries.length; i += batchSize) {
          await supabase.from("time_entries").insert(legacySummaries.slice(i, i + batchSize) as any);
        }
      }

      toast.success(
        `Imported ${matchInfo?.totalUnique || 0} courses, ${timeCount} time entries.`
      );
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
                  <TableHead>Course</TableHead><TableHead>Hours</TableHead><TableHead>Year</TableHead><TableHead>Tool</TableHead><TableHead>Vertical</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {legacyData.slice(0, 20).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.courseName}</TableCell>
                      <TableCell>{Math.round(c.totalHours * 100) / 100}</TableCell>
                      <TableCell>{c.reportingYear}</TableCell>
                      <TableCell>{c.authoringTool}</TableCell>
                      <TableCell>{c.vertical}</TableCell>
                    </TableRow>
                  ))}
                  {legacyData.length > 20 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">…and {legacyData.length - 20} more</TableCell></TableRow>
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
                  <TableHead>Course</TableHead><TableHead>Year</TableHead><TableHead>Tool</TableHead><TableHead>Vertical</TableHead><TableHead>Type</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {modernData.slice(0, 20).map((c, i) => (
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
                  <TableHead>Course</TableHead><TableHead>Category</TableHead><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead>User</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {timeData.slice(0, 20).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{e.courseName}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell>{e.date}</TableCell>
                      <TableCell>{Math.round(e.hours * 100) / 100}</TableCell>
                      <TableCell>{e.userName}</TableCell>
                    </TableRow>
                  ))}
                  {timeData.length > 20 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">…and {timeData.length - 20} more</TableCell></TableRow>
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
                <TableHead>File</TableHead><TableHead>Rows</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {history.map((h) => (
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
