import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useTimeEntries } from "@/hooks/use-time-data";
import { Download, Search, ArrowUpDown } from "lucide-react";

type SortKey = "project" | "phase" | "hours" | "quarter";

export default function DataExplorer() {
  const { data: entries = [] } = useTimeEntries();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("project");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries
      .map((e) => ({
        ...e,
        projectName: (e.projects as any)?.name || "Unknown",
      }))
      .filter(
        (e) =>
          e.projectName.toLowerCase().includes(q) ||
          e.phase.toLowerCase().includes(q) ||
          (e.quarter || "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "project": cmp = a.projectName.localeCompare(b.projectName); break;
          case "phase": cmp = a.phase.localeCompare(b.phase); break;
          case "hours": cmp = Number(a.hours) - Number(b.hours); break;
          case "quarter": cmp = (a.quarter || "").localeCompare(b.quarter || ""); break;
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [entries, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const exportCsv = () => {
    const header = "Project,Phase,Hours,Quarter\n";
    const rows = filtered.map((e) => `"${e.projectName}","${e.phase}",${e.hours},"${e.quarter || ""}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "time_entries.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">
        {label} <ArrowUpDown className="h-3 w-3" />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Explorer</h1>
          <p className="text-muted-foreground">{filtered.length} entries</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by project, phase, or quarter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No entries found.</p>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader label="Project" field="project" />
                    <SortHeader label="Phase" field="phase" />
                    <SortHeader label="Hours" field="hours" />
                    <SortHeader label="Quarter" field="quarter" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.projectName}</TableCell>
                      <TableCell>{e.phase}</TableCell>
                      <TableCell>{e.hours}</TableCell>
                      <TableCell>{e.quarter}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
