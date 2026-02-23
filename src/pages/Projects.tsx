import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTimeEntries, useProjects } from "@/hooks/use-time-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Projects() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const projectSummaries = useMemo(() => {
    const map: Record<string, { name: string; id: string; totalHours: number; phases: Record<string, number>; meta: any }> = {};
    projects.forEach((p: any) => {
      map[p.id] = { name: p.name, id: p.id, totalHours: 0, phases: {}, meta: p };
    });
    entries.forEach((e) => {
      if (e.project_id && map[e.project_id]) {
        map[e.project_id].totalHours += Number(e.hours);
        map[e.project_id].phases[e.phase] = (map[e.project_id].phases[e.phase] || 0) + Number(e.hours);
      }
    });
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [entries, projects]);

  const selected = selectedProjectId ? projectSummaries.find((p) => p.id === selectedProjectId) : null;
  const selectedEntries = selectedProjectId ? entries.filter((e) => e.project_id === selectedProjectId) : [];

  const phaseChartData = selected
    ? Object.entries(selected.phases)
        .map(([name, hours]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, hours: Math.round(hours * 100) / 100 }))
        .sort((a, b) => b.hours - a.hours)
    : [];

  if (selected) {
    const m = selected.meta;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedProjectId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{selected.name}</h1>
            <p className="text-muted-foreground">{Math.round(selected.totalHours * 100) / 100} total hours</p>
          </div>
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2">
          {m.authoring_tool && <Badge variant="secondary">{m.authoring_tool}</Badge>}
          {m.vertical && <Badge variant="outline">{m.vertical}</Badge>}
          {m.course_type && <Badge variant="outline">{m.course_type}</Badge>}
          {m.course_style && <Badge variant="outline">{m.course_style}</Badge>}
          {m.id_assigned && <Badge variant="secondary">{m.id_assigned}</Badge>}
          {m.reporting_year && <Badge variant="outline">{m.reporting_year}</Badge>}
          {m.course_length && <Badge variant="outline">{m.course_length}</Badge>}
          {m.interaction_count != null && <Badge variant="outline">{m.interaction_count} interactions</Badge>}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Hours by Phase</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phaseChartData} layout="vertical" margin={{ left: 20 }}>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phase</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Quarter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.phase}</TableCell>
                    <TableCell>{e.hours}</TableCell>
                    <TableCell>{e.quarter}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      {projectSummaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No projects yet. Upload data to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectSummaries.map((p) => {
            const m = p.meta;
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedProjectId(p.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">{p.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{Math.round(p.totalHours * 100) / 100}h</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Object.keys(p.phases).length} phases
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {m.authoring_tool && <Badge variant="secondary" className="text-xs">{m.authoring_tool}</Badge>}
                    {m.vertical && <Badge variant="outline" className="text-xs">{m.vertical}</Badge>}
                    {m.course_type && <Badge variant="outline" className="text-xs">{m.course_type}</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
