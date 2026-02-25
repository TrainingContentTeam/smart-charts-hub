import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useTimeEntries, useProjects } from "@/hooks/use-time-data";
import { Download, Search, ArrowUpDown } from "lucide-react";

type SortKey = "project" | "category" | "hours" | "date" | "user" | "authoring_tool" | "vertical" | "course_type";

export default function DataExplorer() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("project");
  const [sortAsc, setSortAsc] = useState(true);

  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries
      .map((e: any) => {
        const project = projectMap.get(e.project_id);
        return {
          ...e,
          projectName: (project as any)?.name || "Unknown",
          authoring_tool: (project as any)?.authoring_tool || "",
          vertical: (project as any)?.vertical || "",
          course_type: (project as any)?.course_type || "",
        };
      })
      .filter(
        (e: any) =>
          e.projectName.toLowerCase().includes(q) ||
          (e.category || "").toLowerCase().includes(q) ||
          (e.user_name || "").toLowerCase().includes(q) ||
          (e.entry_date || "").includes(q) ||
          e.authoring_tool.toLowerCase().includes(q) ||
          e.vertical.toLowerCase().includes(q) ||
          e.course_type.toLowerCase().includes(q)
      )
      .sort((a: any, b: any) => {
        let cmp = 0;
        switch (sortKey) {
          case "project": cmp = a.projectName.localeCompare(b.projectName); break;
          case "category": cmp = (a.category || "").localeCompare(b.category || ""); break;
          case "hours": cmp = Number(a.hours) - Number(b.hours); break;
          case "date": cmp = (a.entry_date || "").localeCompare(b.entry_date || ""); break;
          case "user": cmp = (a.user_name || "").localeCompare(b.user_name || ""); break;
          case "authoring_tool": cmp = a.authoring_tool.localeCompare(b.authoring_tool); break;
          case "vertical": cmp = a.vertical.localeCompare(b.vertical); break;
          case "course_type": cmp = a.course_type.localeCompare(b.course_type); break;
        }
        return sortAsc ? cmp : -cmp;
      });
  }, [entries, projects, projectMap, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const exportCsv = () => {
    const header = "Project,Category,Hours,Date,User,Authoring Tool,Vertical,Course Type\n";
    const rows = filtered.map((e: any) =>
      `"${e.projectName}","${e.category || ""}",${e.hours},"${e.entry_date || ""}","${e.user_name || ""}","${e.authoring_tool}","${e.vertical}","${e.course_type}"`
    ).join("\n");
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
              placeholder="Search by project, category, user, date…"
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
                    <SortHeader label="Category" field="category" />
                    <SortHeader label="Hours" field="hours" />
                    <SortHeader label="Date" field="date" />
                    <SortHeader label="User" field="user" />
                    <SortHeader label="Tool" field="authoring_tool" />
                    <SortHeader label="Vertical" field="vertical" />
                    <SortHeader label="Type" field="course_type" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.projectName}</TableCell>
                      <TableCell>{e.category || e.phase}</TableCell>
                      <TableCell>{e.hours}</TableCell>
                      <TableCell>{e.entry_date || ""}</TableCell>
                      <TableCell>{e.user_name || ""}</TableCell>
                      <TableCell>{e.authoring_tool}</TableCell>
                      <TableCell>{e.vertical}</TableCell>
                      <TableCell>{e.course_type}</TableCell>
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
