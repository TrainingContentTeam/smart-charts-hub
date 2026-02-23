import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Link2 } from "lucide-react";
import { parseWrikeFile, type ParsedEntry } from "@/lib/parse-wrike";
import { parseCourseDataFile, type ParsedCourse } from "@/lib/parse-course-data";
import { supabase } from "@/integrations/supabase/client";
import { useUploadHistory } from "@/hooks/use-time-data";
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

export default function UploadData() {
  const [courseFile, setCourseFile] = useState("");
  const [timeFile, setTimeFile] = useState("");
  const [courses, setCourses] = useState<ParsedCourse[] | null>(null);
  const [timeEntries, setTimeEntries] = useState<ParsedEntry[] | null>(null);
  const [importing, setImporting] = useState(false);
  const { data: history = [] } = useUploadHistory();
  const queryClient = useQueryClient();

  const handleCourseFile = useCallback(async (file: File) => {
    setCourseFile(file.name);
    try {
      const data = await parseCourseDataFile(file);
      setCourses(data);
      if (data.length === 0) toast.warning("No course entries found.");
    } catch {
      toast.error("Failed to parse course data file.");
    }
  }, []);

  const handleTimeFile = useCallback(async (file: File) => {
    setTimeFile(file.name);
    try {
      const data = await parseWrikeFile(file);
      setTimeEntries(data);
      if (data.length === 0) toast.warning("No time entries found.");
    } catch {
      toast.error("Failed to parse time entries file.");
    }
  }, []);

  // Match preview
  const matchInfo = (() => {
    if (!courses && !timeEntries) return null;
    const courseNames = new Set(courses?.map((c) => c.title.toLowerCase()) || []);
    const timeProjects = new Set(timeEntries?.map((e) => e.project.toLowerCase()) || []);
    const matched = [...courseNames].filter((n) => timeProjects.has(n)).length;
    return {
      courseCount: courses?.length || 0,
      timeCount: timeEntries?.length || 0,
      matched,
      unmatchedCourses: (courses?.length || 0) - matched,
      unmatchedTime: new Set([...timeProjects].filter((n) => !courseNames.has(n))).size,
    };
  })();

  const importData = async () => {
    if (!courses && !timeEntries) return;
    setImporting(true);
    try {
      const totalRows = (courses?.length || 0) + (timeEntries?.length || 0);
      const combinedFileName = [courseFile, timeFile].filter(Boolean).join(" + ");

      // Upload history
      const { data: upload, error: uploadErr } = await supabase
        .from("upload_history")
        .insert({ file_name: combinedFileName, row_count: totalRows })
        .select()
        .single();
      if (uploadErr) throw uploadErr;

      // Get existing projects
      const existingProjects = (await supabase.from("projects").select("*")).data || [];
      const existingMap = new Map(existingProjects.map((p: any) => [p.name.toLowerCase(), p]));

      // Upsert courses as projects
      if (courses && courses.length > 0) {
        for (const course of courses) {
          const existing = existingMap.get(course.title.toLowerCase());
          if (existing) {
            await supabase
              .from("projects")
              .update({
                id_assigned: course.idAssigned || existing.id_assigned,
                authoring_tool: course.authoringTool || existing.authoring_tool,
                vertical: course.vertical || existing.vertical,
                course_length: course.courseLength || existing.course_length,
                course_type: course.courseType || existing.course_type,
                course_style: course.courseStyle || existing.course_style,
                reporting_year: course.reportingYear || existing.reporting_year,
                interaction_count: course.interactionCount ?? existing.interaction_count,
              })
              .eq("id", existing.id);
          } else {
            const { data: inserted } = await supabase
              .from("projects")
              .insert({
                name: course.title,
                id_assigned: course.idAssigned,
                authoring_tool: course.authoringTool,
                vertical: course.vertical,
                course_length: course.courseLength,
                course_type: course.courseType,
                course_style: course.courseStyle,
                reporting_year: course.reportingYear,
                interaction_count: course.interactionCount,
              })
              .select()
              .single();
            if (inserted) existingMap.set(course.title.toLowerCase(), inserted);
          }
        }
      }

      // Insert time entries
      let timeCount = 0;
      if (timeEntries && timeEntries.length > 0) {
        // Refresh project map
        const refreshed = (await supabase.from("projects").select("*")).data || [];
        const projectMap = new Map(refreshed.map((p: any) => [p.name.toLowerCase(), p.id]));

        // Upsert any new projects from time entries
        const newTimeProjects = [...new Set(timeEntries.map((e) => e.project))].filter(
          (n) => !projectMap.has(n.toLowerCase())
        );
        if (newTimeProjects.length > 0) {
          const { data: inserted } = await supabase
            .from("projects")
            .insert(newTimeProjects.map((name) => ({ name })))
            .select();
          inserted?.forEach((p: any) => projectMap.set(p.name.toLowerCase(), p.id));
        }

        const entries = timeEntries.map((e) => ({
          project_id: projectMap.get(e.project.toLowerCase()) || null,
          phase: e.phase,
          hours: e.hours,
          quarter: e.quarter,
          raw_task_name: e.rawTaskName,
          raw_time_spent: e.rawTimeSpent,
          upload_id: upload.id,
        }));

        const { error: entryErr } = await supabase.from("time_entries").insert(entries);
        if (entryErr) throw entryErr;
        timeCount = entries.length;
      }

      toast.success(
        `Imported ${courses?.length || 0} courses, ${timeCount} time entries. ${matchInfo?.matched || 0} matched.`
      );
      setCourses(null);
      setTimeEntries(null);
      setCourseFile("");
      setTimeFile("");
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["upload_history"] });
    } catch (err: any) {
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const hasAnything = courses || timeEntries;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">Import your Course Data and Time Entries files</p>
      </div>

      {/* Two-panel drop zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DropZone
          label="Course Data"
          description="Course_Data.xlsx — metadata & attributes"
          fileName={courseFile}
          count={courses?.length ?? null}
          onFile={handleCourseFile}
          id="course-file-input"
        />
        <DropZone
          label="Time Entries"
          description="Time_Spent.xlsx — hours by phase"
          fileName={timeFile}
          count={timeEntries?.length ?? null}
          onFile={handleTimeFile}
          id="time-file-input"
        />
      </div>

      {/* Match Preview */}
      {matchInfo && (courses || timeEntries) && (
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
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{matchInfo.courseCount}</p>
                <p className="text-xs text-muted-foreground">Courses</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{matchInfo.timeCount}</p>
                <p className="text-xs text-muted-foreground">Time Entries</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{matchInfo.matched}</p>
                <p className="text-xs text-muted-foreground">Matched</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{matchInfo.unmatchedCourses + matchInfo.unmatchedTime}</p>
                <p className="text-xs text-muted-foreground">Unmatched</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview tables */}
      {courses && courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{courseFile} — {courses.length} courses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Tool</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.slice(0, 30).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>{c.authoringTool}</TableCell>
                      <TableCell>{c.vertical}</TableCell>
                      <TableCell>{c.courseType}</TableCell>
                      <TableCell>{c.idAssigned}</TableCell>
                    </TableRow>
                  ))}
                  {courses.length > 30 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        …and {courses.length - 30} more
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {timeEntries && timeEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{timeFile} — {timeEntries.length} entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Quarter</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.slice(0, 30).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{e.project}</TableCell>
                      <TableCell>{e.phase}</TableCell>
                      <TableCell>{e.hours}</TableCell>
                      <TableCell>{e.quarter}</TableCell>
                    </TableRow>
                  ))}
                  {timeEntries.length > 30 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        …and {timeEntries.length - 30} more
                      </TableCell>
                    </TableRow>
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
          <CardHeader>
            <CardTitle className="text-base">Upload History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
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
