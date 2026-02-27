import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ChartDataRow = Record<string, unknown>;

interface ChartDataTableProps {
  rows: ChartDataRow[];
  columns?: Array<{ key: string; label: string }>;
  emptyLabel?: string;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function ChartDataTable({ rows, columns, emptyLabel = "No data for selected filters." }: ChartDataTableProps) {
  const resolvedColumns =
    columns && columns.length > 0
      ? columns
      : rows.length > 0
        ? Object.keys(rows[0]).map((key) => ({ key, label: key }))
        : [];

  if (resolvedColumns.length === 0 || rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="rounded-md border" data-snapshot-table="true">
      <Table>
        <TableHeader>
          <TableRow>
            {resolvedColumns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {resolvedColumns.map((col) => (
                <TableCell key={col.key}>{cellText(row[col.key])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
