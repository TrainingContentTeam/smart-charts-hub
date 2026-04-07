import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, LibraryBig, Upload, AlertCircle, ArrowRight, RotateCcw, ExternalLink } from "lucide-react";
import { parseLmsCourseInfoFile, type LmsCourseInfoImport } from "@/lib/parse-lms-course-info";
import { parseLmsCourseVersionsFile, type LmsCourseVersionImport } from "@/lib/parse-lms-course-versions";
import { makeId, readLocalStore, writeLocalStore } from "@/lib/local-data-store";
import { useCatalogUploadHistory } from "@/hooks/use-time-data";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
          <input
            id={id}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return value;
}

function OpenLinkButton({ href, label }: { href: unknown; label: string }) {
  const url = String(href || "").trim();
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

export default function MasterContentInventoryUpload() {
  const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";
  const [infoFile, setInfoFile] = useState("");
  const [versionsFile, setVersionsFile] = useState("");
  const [infoRows, setInfoRows] = useState<LmsCourseInfoImport[] | null>(null);
  const [versionRows, setVersionRows] = useState<LmsCourseVersionImport[] | null>(null);
  const [importingInfo, setImportingInfo] = useState(false);
  const [importingVersions, setImportingVersions] = useState(false);
  const [resettingLocalCatalog, setResettingLocalCatalog] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: history = [] } = useCatalogUploadHistory();

  const handleInfoFile = useCallback(async (file: File) => {
    setInfoFile(file.name);
    try {
      const parsed = await parseLmsCourseInfoFile(file);
      setInfoRows(parsed);
      if (parsed.length === 0) toast.warning("No LMS course info rows were found.");
    } catch {
      toast.error("Failed to parse LMS course info file.");
    }
  }, []);

  const handleVersionsFile = useCallback(async (file: File) => {
    setVersionsFile(file.name);
    try {
      const parsed = await parseLmsCourseVersionsFile(file);
      setVersionRows(parsed);
      if (parsed.length === 0) toast.warning("No LMS course version rows were found.");
    } catch {
      toast.error("Failed to parse LMS course versions file.");
    }
  }, []);

  const invalidVersionRows = useMemo(
    () => (versionRows || []).filter((row) => !row.versionValid),
    [versionRows],
  );

  const derivedVersionRows = useMemo(
    () => (versionRows || []).filter((row) => row.versionSource === "derived" && row.versionValid),
    [versionRows],
  );

  const resetInfoPreview = () => {
    setInfoFile("");
    setInfoRows(null);
  };

  const resetVersionsPreview = () => {
    setVersionsFile("");
    setVersionRows(null);
  };

  const resetLocalCatalogData = async () => {
    if (!DEV_BYPASS_AUTH) return;
    setResettingLocalCatalog(true);
    try {
      const local = await readLocalStore();
      await writeLocalStore({
        ...local,
        lms_course_info: [],
        lms_course_versions: [],
        upload_history: local.upload_history.filter((row) => !String(row.dataset_type || "").startsWith("catalog_")),
      });
      refreshQueries();
      resetInfoPreview();
      resetVersionsPreview();
      toast.success("Local bypass catalog data cleared. You can re-upload fresh files now.");
    } catch (error: any) {
      toast.error("Failed to clear local catalog data: " + (error.message || "Unknown error"));
    } finally {
      setResettingLocalCatalog(false);
    }
  };

  const refreshQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["lms_course_info"] });
    queryClient.invalidateQueries({ queryKey: ["lms_course_versions"] });
    queryClient.invalidateQueries({ queryKey: ["catalog_upload_history"] });
    queryClient.invalidateQueries({ queryKey: ["upload_history"] });
  };

  const importInfoRows = async () => {
    if (!infoRows) return;
    setImportingInfo(true);
    try {
      const now = new Date().toISOString();
      const uploadId = makeId();

      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        await writeLocalStore({
          ...local,
          lms_course_info: infoRows.map((row) => ({
            course_id: row.courseId,
            original_publish_date: row.originalPublishDate,
            course_type: row.courseType || null,
            backend_url: row.backendUrl || null,
            frontend_url: row.frontendUrl || null,
            upload_id: uploadId,
            user_id: user?.id,
            created_at: now,
            updated_at: now,
          })),
          upload_history: [
            {
              id: uploadId,
              file_name: infoFile,
              row_count: infoRows.length,
              status: "completed",
              dataset_type: "catalog_course_info",
              user_id: user?.id,
              created_at: now,
            },
            ...local.upload_history,
          ],
        });
      } else {
        const { error: uploadError } = await supabase.from("upload_history").insert({
          id: uploadId,
          file_name: infoFile,
          row_count: infoRows.length,
          status: "completed",
          dataset_type: "catalog_course_info",
          user_id: user?.id,
        } as any);
        if (uploadError) throw uploadError;

        const { error: deleteError } = await supabase.from("lms_course_info").delete().not("course_id", "is", null);
        if (deleteError) throw deleteError;

        const infoBatch = infoRows.map((row) => ({
          course_id: row.courseId,
          original_publish_date: row.originalPublishDate,
          course_type: row.courseType || null,
          backend_url: row.backendUrl || null,
          frontend_url: row.frontendUrl || null,
          upload_id: uploadId,
          user_id: user?.id,
          created_at: now,
          updated_at: now,
        }));
        const BATCH = 500;
        for (let i = 0; i < infoBatch.length; i += BATCH) {
          const { error: insertError } = await supabase
            .from("lms_course_info")
            .insert(infoBatch.slice(i, i + BATCH) as any);
          if (insertError) throw insertError;
        }
      }

      refreshQueries();
      toast.success(`Replaced LMS Course Info with ${infoRows.length} rows.`);
      resetInfoPreview();
    } catch (error: any) {
      toast.error("LMS Course Info import failed: " + (error.message || "Unknown error"));
    } finally {
      setImportingInfo(false);
    }
  };

  const importVersionRows = async () => {
    if (!versionRows) return;
    if (invalidVersionRows.length > 0) {
      toast.error("Fix the invalid course version rows before importing.");
      return;
    }

    setImportingVersions(true);
    try {
      const now = new Date().toISOString();
      const uploadId = makeId();

      if (DEV_BYPASS_AUTH) {
        const local = await readLocalStore();
        await writeLocalStore({
          ...local,
          lms_course_versions: versionRows.map((row) => ({
            id: makeId(),
            course_id: row.courseId,
            course_version: row.courseVersion,
            course_name: row.courseName || null,
            authoring_tool: row.authoringTool || null,
            course_description: row.courseDescription || null,
            duration_minutes: row.durationMinutes,
            published_date: row.publishedDate,
            change_type: row.changeType || null,
            lesson_plan: row.lessonPlan || null,
            special: row.special || null,
            ems1a: row.ems1a || null,
            p1a: row.p1a || null,
            fr1a: row.fr1a || null,
            c1a: row.c1a || null,
            lgu: row.lgu || null,
            d1a: row.d1a || null,
            revamp_date: row.revampDate,
            version_derived: row.versionSource === "derived",
            upload_id: uploadId,
            user_id: user?.id,
            created_at: now,
            updated_at: now,
          })),
          upload_history: [
            {
              id: uploadId,
              file_name: versionsFile,
              row_count: versionRows.length,
              status: "completed",
              dataset_type: "catalog_course_versions",
              user_id: user?.id,
              created_at: now,
            },
            ...local.upload_history,
          ],
        });
      } else {
        const { error: uploadError } = await supabase.from("upload_history").insert({
          id: uploadId,
          file_name: versionsFile,
          row_count: versionRows.length,
          status: "completed",
          dataset_type: "catalog_course_versions",
          user_id: user?.id,
        } as any);
        if (uploadError) throw uploadError;

        const { error: deleteError } = await supabase.from("lms_course_versions").delete().not("course_id", "is", null);
        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from("lms_course_versions").insert(
          versionRows.map((row) => ({
            course_id: row.courseId,
            course_version: row.courseVersion,
            course_name: row.courseName || null,
            authoring_tool: row.authoringTool || null,
            course_description: row.courseDescription || null,
            duration_minutes: row.durationMinutes,
            published_date: row.publishedDate,
            change_type: row.changeType || null,
            lesson_plan: row.lessonPlan || null,
            special: row.special || null,
            ems1a: row.ems1a || null,
            p1a: row.p1a || null,
            fr1a: row.fr1a || null,
            c1a: row.c1a || null,
            lgu: row.lgu || null,
            d1a: row.d1a || null,
            revamp_date: row.revampDate,
            version_derived: row.versionSource === "derived",
            upload_id: uploadId,
            user_id: user?.id,
            created_at: now,
            updated_at: now,
          })) as any,
        );
        if (insertError) throw insertError;
      }

      refreshQueries();
      toast.success(`Replaced LMS Course Versions with ${versionRows.length} rows.`);
      resetVersionsPreview();
    } catch (error: any) {
      toast.error("LMS Course Versions import failed: " + (error.message || "Unknown error"));
    } finally {
      setImportingVersions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catalog Uploads</h1>
          <p className="text-muted-foreground">
            Upload LMS catalog snapshots separately from project production data. Each import fully replaces its own dataset.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/master-content-inventory">
            <LibraryBig className="mr-2 h-4 w-4" />
            Open Master Content Inventory
          </Link>
        </Button>
      </div>

      {DEV_BYPASS_AUTH && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Local Bypass Catalog Reset</CardTitle>
              <p className="text-sm text-muted-foreground">
                Clears only catalog records and catalog upload history in local bypass mode so you can re-upload from a clean catalog state.
              </p>
            </div>
            <Button variant="destructive" onClick={resetLocalCatalogData} disabled={resettingLocalCatalog}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {resettingLocalCatalog ? "Clearing…" : "Clear Catalog Data"}
            </Button>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <DropZone
            label="LMS Course Info"
            description="One row per course ID with LMS metadata."
            fileName={infoFile}
            count={infoRows?.length ?? null}
            onFile={handleInfoFile}
            id="catalog-info-file"
          />

          {infoRows && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Course Info Preview</CardTitle>
                  <p className="text-sm text-muted-foreground">{infoRows.length} rows ready to replace the current info snapshot.</p>
                </div>
                <Button onClick={importInfoRows} disabled={importingInfo}>
                  {importingInfo ? "Importing…" : "Import LMS Course Info"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Rows</p>
                    <p className="text-2xl font-bold">{infoRows.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Unique Course IDs</p>
                    <p className="text-2xl font-bold">{new Set(infoRows.map((row) => row.courseId)).size}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">With URLs</p>
                    <p className="text-2xl font-bold">
                      {infoRows.filter((row) => row.backendUrl || row.frontendUrl).length}
                    </p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course ID</TableHead>
                      <TableHead>Published Date</TableHead>
                      <TableHead>Content Type</TableHead>
                      <TableHead>Backend URL</TableHead>
                      <TableHead>Frontend URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {infoRows.slice(0, 8).map((row) => (
                      <TableRow key={row.courseId}>
                        <TableCell className="font-medium">{row.courseId}</TableCell>
                        <TableCell>{formatDate(row.originalPublishDate)}</TableCell>
                        <TableCell>{row.courseType || "—"}</TableCell>
                        <TableCell><OpenLinkButton href={row.backendUrl} label="Open Backend" /></TableCell>
                        <TableCell><OpenLinkButton href={row.frontendUrl} label="Open Frontend" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <DropZone
            label="LMS Course Versions"
            description="One or more rows per course ID. Missing versions can be derived from update date."
            fileName={versionsFile}
            count={versionRows?.length ?? null}
            onFile={handleVersionsFile}
            id="catalog-versions-file"
          />

          {versionRows && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Course Versions Preview</CardTitle>
                  <p className="text-sm text-muted-foreground">{versionRows.length} rows ready to replace the current versions snapshot.</p>
                </div>
                <Button onClick={importVersionRows} disabled={importingVersions || invalidVersionRows.length > 0}>
                  {importingVersions ? "Importing…" : "Import LMS Course Versions"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Rows</p>
                    <p className="text-2xl font-bold">{versionRows.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Unique Course IDs</p>
                    <p className="text-2xl font-bold">{new Set(versionRows.map((row) => row.courseId)).size}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Derived Versions</p>
                    <p className="text-2xl font-bold">{derivedVersionRows.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Invalid Versions</p>
                    <p className={`text-2xl font-bold ${invalidVersionRows.length > 0 ? "text-destructive" : ""}`}>
                      {invalidVersionRows.length}
                    </p>
                  </div>
                </div>

                {invalidVersionRows.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Fix these rows before import
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      {invalidVersionRows.slice(0, 5).map((row, index) => (
                        <p key={`${row.courseId}-${index}`}>{row.courseId}: {row.versionError}</p>
                      ))}
                    </div>
                  </div>
                )}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course ID</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Update Date</TableHead>
                      <TableHead>Update Type</TableHead>
                      <TableHead>Lesson Plan</TableHead>
                      <TableHead>Special</TableHead>
                      <TableHead>Verticals</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versionRows.slice(0, 8).map((row, index) => (
                      <TableRow key={`${row.courseId}-${row.courseVersion || index}`}>
                        <TableCell className="font-medium">{row.courseId}</TableCell>
                        <TableCell>{row.courseVersion || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={row.versionSource === "derived" ? "secondary" : "outline"}>
                            {row.versionSource === "derived" ? "Auto-derived" : "Source"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(row.publishedDate)}</TableCell>
                        <TableCell>{row.changeType || "—"}</TableCell>
                        <TableCell><OpenLinkButton href={row.lessonPlan} label="Open Lesson Plan" /></TableCell>
                        <TableCell>{row.special || "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate">
                          {[row.ems1a && "EMS1A", row.p1a && "P1A", row.fr1a && "FR1A", row.c1a && "C1A", row.lgu && "LGU", row.d1a && "D1A"].filter(Boolean).join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalog Upload History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No catalog uploads yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Imported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.dataset_type === "catalog_course_versions" ? "LMS Course Versions" : "LMS Course Info"}</TableCell>
                    <TableCell>{row.file_name}</TableCell>
                    <TableCell>{row.row_count}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.created_at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end">
            <Button asChild variant="ghost">
              <Link to="/master-content-inventory">
                Browse the catalog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
