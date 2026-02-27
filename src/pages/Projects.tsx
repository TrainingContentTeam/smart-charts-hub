import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTimeEntries, useProjects } from "@/hooks/use-time-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, ArrowUpDown, BookOpen, Video, Clock3, CalendarDays, Ruler, Camera } from "lucide-react";
import { CollaborationSurveyComingSoon } from "@/components/CollaborationSurveyComingSoon";
import { saveChartSnapshot } from "@/lib/chart-snapshot";

function text(v: unknown): string {
  return String(v || "").trim();
}

function number(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function prettyLabel(label: string) {
  return label
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

export default function Projects() {
  const { data: entries = [] } = useTimeEntries();
  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailSortKey, setDetailSortKey] = useState<"category" | "hours" | "date" | "user">("date");
  const [detailSortAsc, setDetailSortAsc] = useState(false);

  const projectsWithRelativePosition = useMemo(() => {
    const withMetrics = projects.map((p: any) => {
      const length = text(p.course_length || "Unknown");
      const cohort = projects
        .filter((x: any) => text(x.course_length || "Unknown") === length)
        .map((x: any) => number(x.total_hours));
      const sorted = [...cohort].sort((a, b) => a - b);
      const current = number(p.total_hours);
      const idx = sorted.findIndex((v) => v >= current);
      const rank = idx === -1 ? sorted.length - 1 : idx;
      const percentile = sorted.length > 1 ? Math.round((rank / (sorted.length - 1)) * 100) : 100;

      return {
        ...p,
        totalHoursNum: current,
        cohortLengthLabel: length,
        cohortSize: sorted.length,
        percentile,
      };
    });

    return withMetrics;
  }, [projects]);

  const latestActivityByProjectId = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e: any) => {
      const projectId = text(e.project_id);
      if (!projectId) return;
      const dt = text(e.entry_date) || text(e.created_at);
      const ts = dt ? Date.parse(dt) : 0;
      if (!Number.isFinite(ts)) return;
      const prev = map.get(projectId) || 0;
      if (ts > prev) map.set(projectId, ts);
    });
    return map;
  }, [entries]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projectsWithRelativePosition
      .filter((p: any) => {
        if (!q) return true;
        return (
          text(p.name).toLowerCase().includes(q) ||
          text(p.reporting_year).toLowerCase().includes(q) ||
          text(p.course_type).toLowerCase().includes(q) ||
          text(p.authoring_tool).toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => {
        const aActivity = latestActivityByProjectId.get(a.id) || 0;
        const bActivity = latestActivityByProjectId.get(b.id) || 0;
        if (bActivity !== aActivity) return bActivity - aActivity;
        return b.totalHoursNum - a.totalHoursNum;
      });
  }, [projectsWithRelativePosition, search, latestActivityByProjectId]);

  const selected = selectedProjectId
    ? projectsWithRelativePosition.find((p: any) => p.id === selectedProjectId)
    : null;

  const selectedEntries = selectedProjectId ? entries.filter((e: any) => e.project_id === selectedProjectId) : [];

  const sortedSelectedEntries = useMemo(() => {
    const rows = [...selectedEntries];
    rows.sort((a: any, b: any) => {
      let cmp = 0;
      switch (detailSortKey) {
        case "category": cmp = text(a.category || a.phase).localeCompare(text(b.category || b.phase)); break;
        case "hours": cmp = number(a.hours) - number(b.hours); break;
        case "date": cmp = text(a.entry_date).localeCompare(text(b.entry_date)); break;
        case "user": cmp = text(a.user_name).localeCompare(text(b.user_name)); break;
      }
      return detailSortAsc ? cmp : -cmp;
    });
    return rows;
  }, [selectedEntries, detailSortKey, detailSortAsc]);

  const toggleDetailSort = (key: "category" | "hours" | "date" | "user") => {
    if (detailSortKey === key) setDetailSortAsc((v) => !v);
    else {
      setDetailSortKey(key);
      setDetailSortAsc(true);
    }
  };

  const categoryBreakdown = useMemo(() => {
    if (!selectedProjectId) return [];
    const map: Record<string, number> = {};
    selectedEntries.forEach((e: any) => {
      const cat = text(e.category || e.phase || "Uncategorized");
      map[cat] = (map[cat] || 0) + number(e.hours);
    });
    return Object.entries(map)
      .map(([name, hours]) => ({ name: name.length > 24 ? `${name.slice(0, 24)}...` : name, fullName: name, hours: Math.round(hours * 100) / 100 }))
      .sort((a, b) => b.hours - a.hours);
  }, [selectedProjectId, selectedEntries]);

  const metadataRows = useMemo(() => {
    if (!selected) return [];
    const fields = [
      "status",
      "reporting_year",
      "total_hours",
      "course_type",
      "authoring_tool",
      "course_style",
      "course_length",
      "vertical",
      "interaction_count",
      "id_assigned",
      "sme",
      "legal_reviewer",
      "data_source",
      "created_at",
      "updated_at",
    ];
    return fields.map((field) => ({ field, value: (selected as any)[field] }));
  }, [selected]);

  const SortHead = ({ label, field }: { label: string; field: "category" | "hours" | "date" | "user" }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleDetailSort(field)}>
      <span className="flex items-center gap-1">
        {label} <ArrowUpDown className="h-3 w-3" />
      </span>
    </TableHead>
  );

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
            <p className="text-muted-foreground">
              {Math.round(number(m.total_hours) * 100) / 100} total hours · Reporting Year {text(m.reporting_year) || "Unknown"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Percentile vs Similar Length</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{m.percentile}th</p>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${m.percentile}%`,
                      background: "linear-gradient(90deg, hsl(142 71% 45%), hsl(40 96% 58%), hsl(0 72% 51%))",
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Compared with {m.cohortSize} course(s) of length “{m.cohortLengthLabel}”.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{text(m.status) || "Unknown"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Time Entries</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{selectedEntries.length}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Course Metadata</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {metadataRows.map((row) => (
                <div key={row.field} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{prettyLabel(row.field)}</p>
                  <p className="text-sm font-medium break-words">{text(row.value) || "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Time Spent by Category</CardTitle>
              <Button variant="outline" size="sm" onClick={() => saveChartSnapshot("chart-project-category", `project-${m.id}-category-hours`)}>
                <Camera className="h-3.5 w-3.5 mr-1" /> Snapshot
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div id="chart-project-category" className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" width={180} fontSize={11} />
                  <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Time Entry Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead label="Category" field="category" />
                    <SortHead label="Hours" field="hours" />
                    <SortHead label="Date" field="date" />
                    <SortHead label="User" field="user" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSelectedEntries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{text(e.category || e.phase)}</TableCell>
                      <TableCell>{Math.round(number(e.hours) * 100) / 100}</TableCell>
                      <TableCell>{text(e.entry_date) || "—"}</TableCell>
                      <TableCell>{text(e.user_name) || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <CollaborationSurveyComingSoon />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">Course-level overview and relative time position by similar course length.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No projects found. Upload data to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((p: any) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSelectedProjectId(p.id)}
            >
              <CardHeader className="pb-1 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                      {/video/i.test(text(p.course_type)) || /single\\s*video/i.test(text(p.name)) ? (
                        <Video className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <CardTitle className="text-sm leading-tight">{p.name}</CardTitle>
                  </div>
                  <Badge variant={text(p.status).toLowerCase() === "completed" ? "default" : "secondary"} className="shrink-0 text-xs">
                    {text(p.status) || "Unknown"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" /> Total Time
                    </p>
                    <p className="text-2xl font-semibold">{Math.round(p.totalHoursNum * 100) / 100}h</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.percentile}%`,
                        background: "linear-gradient(90deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.85))",
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Relative effort: {p.percentile}% within {p.cohortSize} similar-length course{p.cohortSize === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Year: {text(p.reporting_year) || "Unknown"}
                  </Badge>
                  <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                    <Ruler className="h-3 w-3" /> Length: {text(p.course_length) || "Unknown"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
