import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTimeEntries, useProjects } from "@/hooks/use-time-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";

export default function Projects() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projects
      .filter((p: any) => !q || p.name.toLowerCase().includes(q))
      .sort((a: any, b: any) => Number(b.total_hours || 0) - Number(a.total_hours || 0));
  }, [projects, search]);

  const selected = selectedProjectId ? projects.find((p: any) => p.id === selectedProjectId) : null;
  const selectedEntries = selectedProjectId ? entries.filter((e: any) => e.project_id === selectedProjectId) : [];

  // Category breakdown for detail view
  const categoryBreakdown = useMemo(() => {
    if (!selectedProjectId) return [];
    const map: Record<string, { hours: number; users: Set<string> }> = {};
    selectedEntries.forEach((e: any) => {
      const cat = e.category || e.phase || "Uncategorized";
      if (!map[cat]) map[cat] = { hours: 0, users: new Set() };
      map[cat].hours += Number(e.hours);
      if (e.user_name) map[cat].users.add(e.user_name);
    });
    return Object.entries(map)
      .map(([name, { hours, users }]) => ({
        name: name.length > 20 ? name.slice(0, 20) + "…" : name,
        fullName: name,
        hours: Math.round(hours * 100) / 100,
        userCount: users.size,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [selectedProjectId, selectedEntries]);

  if (selected) {
    const m = selected as any;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedProjectId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{m.name}</h1>
            <p className="text-muted-foreground">{Math.round(Number(m.total_hours || 0) * 100) / 100} total hours</p>
          </div>
          <Badge variant={m.status === "Completed" ? "default" : "secondary"}>{m.status || "Completed"}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {m.authoring_tool && <Badge variant="secondary">{m.authoring_tool}</Badge>}
          {m.vertical && <Badge variant="outline">{m.vertical}</Badge>}
          {m.course_type && <Badge variant="outline">{m.course_type}</Badge>}
          {m.course_style && <Badge variant="outline">{m.course_style}</Badge>}
          {m.id_assigned && <Badge variant="secondary">{m.id_assigned}</Badge>}
          {m.reporting_year && <Badge variant="outline">{m.reporting_year}</Badge>}
          {m.sme && <Badge variant="outline">SME: {m.sme}</Badge>}
          {m.legal_reviewer && <Badge variant="outline">Legal: {m.legal_reviewer}</Badge>}
          {m.data_source && <Badge variant="outline">{m.data_source}</Badge>}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Hours by Category</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={150} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Time Entries</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEntries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.category || e.phase}</TableCell>
                      <TableCell>{e.hours}</TableCell>
                      <TableCell>{e.entry_date || ""}</TableCell>
                      <TableCell>{e.user_name || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">All projects with time breakdowns</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No projects found. Upload data to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p: any) => (
            <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedProjectId(p.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium leading-tight">{p.name}</CardTitle>
                  <Badge variant={p.status === "In Progress" ? "secondary" : "default"} className="text-xs ml-2 shrink-0">
                    {p.status || "Completed"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{Math.round(Number(p.total_hours || 0) * 100) / 100}h</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.authoring_tool && <Badge variant="secondary" className="text-xs">{p.authoring_tool}</Badge>}
                  {p.vertical && <Badge variant="outline" className="text-xs">{p.vertical}</Badge>}
                  {p.course_type && <Badge variant="outline" className="text-xs">{p.course_type}</Badge>}
                  {p.reporting_year && <Badge variant="outline" className="text-xs">{p.reporting_year}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
