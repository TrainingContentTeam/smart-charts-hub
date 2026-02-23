import * as XLSX from "xlsx";

export interface ParsedEntry {
  project: string;
  phase: string;
  hours: number;
  quarter: string;
  rawTaskName: string;
  rawTimeSpent: string;
}

function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();
  // Handle HH:MM format
  const match = str.match(/^(\d+):(\d+)$/);
  if (match) {
    return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
  }
  // Handle decimal hours
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseWrikeFile(file: File): Promise<ParsedEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const entries: ParsedEntry[] = [];
        let currentProject = "";

        for (const row of rows) {
          const taskName = String(row["Task name"] || row["task name"] || "").trim();
          const timeSpent = String(row["Time spent"] || row["time spent"] || "").trim();
          const folder = String(row["Project or folder"] || row["project or folder"] || "").trim();

          if (!taskName) continue;

          const hours = parseTimeToHours(timeSpent);

          // Detect if this is a parent project row (no time spent or 0:00)
          if (!timeSpent || timeSpent === "0:00" || hours === 0) {
            currentProject = taskName;
            continue;
          }

          // Extract phase from task name
          const phase = taskName;
          const project = currentProject || "Unknown Project";
          const quarter = folder || "Unknown";

          entries.push({
            project,
            phase,
            hours: Math.round(hours * 100) / 100,
            quarter,
            rawTaskName: taskName,
            rawTimeSpent: timeSpent,
          });
        }

        resolve(entries);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
