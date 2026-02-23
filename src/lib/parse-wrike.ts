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

/**
 * Detects if a task name is a header row (project or phase) by checking
 * for a trailing (N) count suffix like "Project Name (12)".
 * Returns the base name without the suffix, or null if not a header.
 */
function extractHeaderName(taskName: string): string | null {
  const match = taskName.match(/^(.+?)\s*\(\d+\)$/);
  return match ? match[1].trim() : null;
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
        let currentPhase = "";

        for (const row of rows) {
          const taskName = String(row["Task name"] || row["task name"] || "").trim();
          const timeSpent = String(row["Time spent"] || row["time spent"] || "").trim();

          if (!taskName) continue;

          const headerBase = extractHeaderName(taskName);

          if (headerBase !== null) {
            // This is a header row (has "(N)" suffix)
            if (headerBase !== currentProject) {
              // New name — could be a new project or a phase under the current project
              // Heuristic: if we have no project yet, or the next entries will use
              // this name, it's a project. We use a simple rule:
              // If currentProject is empty OR headerBase doesn't look like a phase
              // under the current project, treat as new project.
              // Actually, the pattern is: first (N) row = project, subsequent (N) rows
              // with different names under it = phases.
              if (!currentProject) {
                // First project
                currentProject = headerBase;
                currentPhase = "";
              } else {
                // We already have a project — this is a phase header
                currentPhase = headerBase;
              }
            }
            // Skip header rows (they contain totals, not individual entries)
            continue;
          }

          // This is an individual time entry (no "(N)" suffix)
          const hours = parseTimeToHours(timeSpent);
          if (hours === 0) continue;

          // Check if this entry's name matches the current project name
          // If it does, it belongs to the current project+phase
          // If it doesn't match AND we have no project yet, use it as-is
          if (taskName === currentProject || currentProject) {
            // If the task name is different from the project name but we're in a project context,
            // it could be that the project just changed. But per the data format,
            // individual entries repeat the project name.
            // If taskName != currentProject, this might be a new project without a header.
            if (taskName !== currentProject && currentProject) {
              // This entry name doesn't match current project — could be a sub-entry
              // with a different naming. Keep it under current project+phase.
            }

            entries.push({
              project: currentProject || taskName,
              phase: currentPhase || "Uncategorized",
              hours: Math.round(hours * 100) / 100,
              quarter: "",
              rawTaskName: taskName,
              rawTimeSpent: timeSpent,
            });
          }
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
