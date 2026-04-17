import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useUploadHistory } from "@/hooks/use-time-data";
import { makeId } from "@/lib/local-data-store";
import {
  parseLegacyProjectImportFile,
  parseModernProjectImportFile,
  parseSmeImportFile,
  parseTimeLogImportFile,
} from "@/lib/analytics/source-readers";
import {
  replaceLocalImportBundle,
  replaceSharedImportBundle,
} from "@/lib/analytics/persistence";
import type {
  RawProjectImportRowDraft,
  RawSmeFeedbackRowDraft,
  RawTimeLogRowDraft,
  UploadHistoryRecord,
} from "@/lib/analytics/types";

const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

function datasetType(parts: string[]) {
  return parts.join(",");
}

function DropZone({
  label,
  description,
  count,
  fileName,
  onFile,
}: {
  label: string;
  description: string;
  count: number;
  fileName: string;
  onFile: (file: File) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50">
          <input
            className="hidden"
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
            }}
          />
          {fileName ? (
            <>
              <FileSpreadsheet className="mb-2 h-8 w-8 text-primary" />
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">{count} parsed row(s)</p>
            </>
          ) : (
            <>
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Choose a file</p>
              <p className="text-xs text-muted-foreground">.csv, .xls, or .xlsx</p>
            </>
          )}
        </label>
      </CardContent>
    </Card>
  );
}

export default function UploadData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: uploadHistory = [] } = useUploadHistory();

  const [legacyFile, setLegacyFile] = useState("");
  const [modernFile, setModernFile] = useState("");
  const [timeFile, setTimeFile] = useState("");
  const [smeFile, setSmeFile] = useState("");
  const [legacyRows, setLegacyRows] = useState<RawProjectImportRowDraft[]>([]);
  const [modernRows, setModernRows] = useState<RawProjectImportRowDraft[]>([]);
  const [timeRows, setTimeRows] = useState<RawTimeLogRowDraft[]>([]);
  const [smeRows, setSmeRows] = useState<RawSmeFeedbackRowDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const handleLegacy = async (file: File) => {
    const result = await parseLegacyProjectImportFile(file);
    setLegacyFile(file.name);
    setLegacyRows(result.rows);
    setWarnings((current) => [...current.filter((warning) => !warning.startsWith("Legacy:")), ...result.warnings.map((warning) => `Legacy: ${warning}`)]);
  };

  const handleModern = async (file: File) => {
    const result = await parseModernProjectImportFile(file);
    setModernFile(file.name);
    setModernRows(result.rows);
    setWarnings((current) => [...current.filter((warning) => !warning.startsWith("Modern:")), ...result.warnings.map((warning) => `Modern: ${warning}`)]);
  };

  const handleTimeLogs = async (file: File) => {
    const result = await parseTimeLogImportFile(file);
    setTimeFile(file.name);
    setTimeRows(result.rows);
    setWarnings((current) => [...current.filter((warning) => !warning.startsWith("Time Logs:")), ...result.warnings.map((warning) => `Time Logs: ${warning}`)]);
  };

  const handleSme = async (file: File) => {
    const result = await parseSmeImportFile(file);
    setSmeFile(file.name);
    setSmeRows(result.rows);
    setWarnings((current) => [...current.filter((warning) => !warning.startsWith("SME:")), ...result.warnings.map((warning) => `SME: ${warning}`)]);
  };

  const importData = async () => {
    if (!legacyRows.length && !modernRows.length && !timeRows.length && !smeRows.length) return;
    setImporting(true);

    try {
      const now = new Date().toISOString();
      const uploadRecord: UploadHistoryRecord = {
        id: makeId(),
        file_name: [legacyFile, modernFile, timeFile, smeFile].filter(Boolean).join(" + "),
        row_count: legacyRows.length + modernRows.length + timeRows.length + smeRows.length,
        status: "completed",
        dataset_type: datasetType([
          legacyRows.length || modernRows.length ? "projects" : "",
          timeRows.length ? "time_logs" : "",
          smeRows.length ? "sme_feedback" : "",
        ].filter(Boolean)),
        user_id: user?.id ?? null,
        created_at: now,
      };

      if (DEV_BYPASS_AUTH) {
        await replaceLocalImportBundle({
          uploadRecord,
          userId: user?.id ?? null,
          rawProjectImportRows: [...legacyRows, ...modernRows],
          rawTimeLogRows: timeRows,
          rawSmeFeedbackRows: smeRows,
        });
      } else {
        await replaceSharedImportBundle({
          uploadRecord,
          userId: user?.id ?? null,
          rawProjectImportRows: [...legacyRows, ...modernRows],
          rawTimeLogRows: timeRows,
          rawSmeFeedbackRows: smeRows,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["analytics_snapshot"] });
      toast.success("Shared canonical import tables refreshed.");
    } catch (error: any) {
      toast.error(error.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">
          Upload raw source files into the canonical import tables. Matching and reconciliation now happen in the dedicated admin workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DropZone label="Legacy Course Data" description="Historical project registry rows" count={legacyRows.length} fileName={legacyFile} onFile={handleLegacy} />
        <DropZone label="Modern Course Data" description="Current/future project registry rows" count={modernRows.length} fileName={modernFile} onFile={handleModern} />
        <DropZone label="Time Log Data" description="Transactional work-log rows" count={timeRows.length} fileName={timeFile} onFile={handleTimeLogs} />
        <DropZone label="SME Data Report" description="Raw SME collaboration survey rows" count={smeRows.length} fileName={smeFile} onFile={handleSme} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Upload Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Legacy Rows</p>
                <p className="text-2xl font-bold">{legacyRows.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Modern Rows</p>
                <p className="text-2xl font-bold">{modernRows.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Time Log Rows</p>
                <p className="text-2xl font-bold">{timeRows.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">SME Rows</p>
                <p className="text-2xl font-bold">{smeRows.length}</p>
              </CardContent>
            </Card>
          </div>

          {warnings.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="mb-2 text-sm font-medium">Parse Warnings</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button onClick={importData} disabled={importing || (!legacyRows.length && !modernRows.length && !timeRows.length && !smeRows.length)}>
            {importing ? "Importing..." : "Import Canonical Raw Data"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Set</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datasets</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploadHistory.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.file_name}</TableCell>
                  <TableCell>{row.row_count}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.dataset_type || "-"}</TableCell>
                  <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
