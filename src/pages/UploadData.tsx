import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { parseWrikeFile, type ParsedEntry } from "@/lib/parse-wrike";
import { supabase } from "@/integrations/supabase/client";
import { useUploadHistory } from "@/hooks/use-time-data";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function UploadData() {
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedEntry[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const { data: history = [] } = useUploadHistory();
  const queryClient = useQueryClient();

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    try {
      const entries = await parseWrikeFile(file);
      setParsed(entries);
      if (entries.length === 0) {
        toast.warning("No time entries found in the file.");
      }
    } catch {
      toast.error("Failed to parse file. Make sure it's a valid Excel or CSV file.");
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const importData = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      // Create upload history record
      const { data: upload, error: uploadErr } = await supabase
        .from("upload_history")
        .insert({ file_name: fileName, row_count: parsed.length })
        .select()
        .single();
      if (uploadErr) throw uploadErr;

      // Upsert projects
      const projectNames = [...new Set(parsed.map((e) => e.project))];
      const existingProjects = (await supabase.from("projects").select("*")).data || [];
      const existingMap = new Map(existingProjects.map((p) => [p.name, p.id]));

      const newProjects = projectNames.filter((n) => !existingMap.has(n));
      if (newProjects.length > 0) {
        const { data: inserted } = await supabase
          .from("projects")
          .insert(newProjects.map((name) => ({ name })))
          .select();
        inserted?.forEach((p) => existingMap.set(p.name, p.id));
      }

      // Insert time entries
      const entries = parsed.map((e) => ({
        project_id: existingMap.get(e.project) || null,
        phase: e.phase,
        hours: e.hours,
        quarter: e.quarter,
        raw_task_name: e.rawTaskName,
        raw_time_spent: e.rawTimeSpent,
        upload_id: upload.id,
      }));

      const { error: entryErr } = await supabase.from("time_entries").insert(entries);
      if (entryErr) throw entryErr;

      toast.success(`Imported ${entries.length} time entries from ${projectNames.length} projects.`);
      setParsed(null);
      setFileName("");
      queryClient.invalidateQueries({ queryKey: ["time_entries"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["upload_history"] });
    } catch (err: any) {
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">Import your Wrike export files (.xlsx or .csv)</p>
      </div>

      {/* Drop zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-1">Drop your file here or click to browse</p>
            <p className="text-sm text-muted-foreground">Supports .xlsx and .csv files</p>
            <input id="file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileSelect} />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {parsed && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{fileName} — {parsed.length} entries found</CardTitle>
            </div>
            <Button onClick={importData} disabled={importing || parsed.length === 0}>
              {importing ? "Importing…" : "Import Data"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
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
                  {parsed.slice(0, 50).map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{entry.project}</TableCell>
                      <TableCell>{entry.phase}</TableCell>
                      <TableCell>{entry.hours}</TableCell>
                      <TableCell>{entry.quarter}</TableCell>
                    </TableRow>
                  ))}
                  {parsed.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        …and {parsed.length - 50} more entries
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
