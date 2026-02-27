import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjects, useTimeEntries } from "@/hooks/use-time-data";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ArrowUpDown } from "lucide-react";
import { YearPills } from "@/components/YearPills";
import { saveChartSnapshot } from "@/lib/chart-snapshot";
import { ChartActions } from "@/components/ChartActions";
import { ChartDataTable } from "@/components/ChartDataTable";

function clean(v: unknown): string {
  return String(v || "").trim();
}

type TeamRow = {
  id: string;
  project: string;
  year: string;
  category: string;
  user: string;
  hours: number;
};

function isTeamMatch(value: string, team: "legal" | "cqo") {
  const s = value.toLowerCase();
  if (team === "legal") return s.includes("legal");
  return s.includes("cqo");
}

function buildTeamRows(entries: any[], projectMap: Map<string, any>, team: "legal" | "cqo"): TeamRow[] {
  return entries
    .filter((e) => {
      const category = clean(e.category || e.phase);
      const user = clean(e.user_name);
      return isTeamMatch(category, team) || isTeamMatch(user, team);
    })
    .map((e) => {
      const project = projectMap.get(e.project_id);
      return {
        id: e.id,
        project: clean(project?.name || "Unknown Project"),
        year: clean(project?.reporting_year || "Unknown"),
        category: clean(e.category || e.phase || "Uncategorized"),
        user: clean(e.user_name || "Unknown"),
        hours: Math.round(Number(e.hours || 0) * 100) / 100,
      };
    });
}

function TeamSection({ title, rows, color, years }: { title: string; rows: TeamRow[]; color: string; years: string[] }) {
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [topSortKey, setTopSortKey] = useState<"project" | "hours">("hours");
  const [topSortAsc, setTopSortAsc] = useState(false);
  const [detailSortKey, setDetailSortKey] = useState<"project" | "year" | "category" | "user" | "hours">("year");
  const [detailSortAsc, setDetailSortAsc] = useState(false);
  const [showChartData, setShowChartData] = useState(false);
  const filteredRows = useMemo(
    () => (selectedYears.length ? rows.filter((r) => selectedYears.includes(r.year)) : rows),
    [rows, selectedYears]
  );
  const totalHours = Math.round(filteredRows.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;

  const hoursByYear = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach((r) => {
      map[r.year] = (map[r.year] || 0) + r.hours;
    });
    return Object.entries(map)
      .map(([year, hours]) => ({ year, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [filteredRows]);

  const topProjects = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach((r) => {
      const key = `${r.project} (${r.year})`;
      map[key] = (map[key] || 0) + r.hours;
    });
    const ranked = Object.entries(map)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => {
        const cmp = topSortKey === "project" ? a.name.localeCompare(b.name) : a.hours - b.hours;
        return topSortAsc ? cmp : -cmp;
      });
    return ranked.slice(0, 12);
  }, [filteredRows, topSortKey, topSortAsc]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (detailSortKey) {
        case "project": cmp = a.project.localeCompare(b.project); break;
        case "year": cmp = a.year.localeCompare(b.year); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "user": cmp = a.user.localeCompare(b.user); break;
        case "hours": cmp = a.hours - b.hours; break;
      }
      return detailSortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, detailSortKey, detailSortAsc]);

  const DetailHead = ({ label, field, right = false }: { label: string; field: "project" | "year" | "category" | "user" | "hours"; right?: boolean }) => (
    <TableHead className={`${right ? "text-right" : ""} cursor-pointer select-none`} onClick={() => {
      if (detailSortKey === field) setDetailSortAsc((v) => !v);
      else {
        setDetailSortKey(field);
        setDetailSortAsc(true);
      }
    }}>
      <span className={`flex items-center gap-1 ${right ? "justify-end" : ""}`}>
        {label} <ArrowUpDown className="h-3 w-3" />
      </span>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Time Entries</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{filteredRows.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Hours</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{totalHours}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Projects Touched</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{new Set(filteredRows.map((r) => r.project + r.year)).size}</p></CardContent>
          </Card>
        </div>

        <YearPills years={years} selectedYears={selectedYears} onChange={setSelectedYears} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Hours by Year</CardTitle>
                <ChartActions
                  showData={showChartData}
                  onToggleData={() => setShowChartData((v) => !v)}
                  onSnapshot={() => saveChartSnapshot(`chart-${title.toLowerCase().replace(/\s+/g, "-")}-hours`, `${title.toLowerCase().replace(/\s+/g, "-")}-hours-by-year`)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div id={`chart-${title.toLowerCase().replace(/\s+/g, "-")}-hours`} className="space-y-3">
                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hoursByYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} />
                      <Bar dataKey="hours" fill={color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {showChartData && <ChartDataTable rows={hoursByYear} columns={[{ key: "year", label: "Year" }, { key: "hours", label: "Hours" }]} />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Top Projects by Team Hours</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[280px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => {
                        if (topSortKey === "project") setTopSortAsc((v) => !v);
                        else {
                          setTopSortKey("project");
                          setTopSortAsc(true);
                        }
                      }}>
                        <span className="flex items-center gap-1">
                          Project <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead className="text-right cursor-pointer select-none" onClick={() => {
                        if (topSortKey === "hours") setTopSortAsc((v) => !v);
                        else {
                          setTopSortKey("hours");
                          setTopSortAsc(false);
                        }
                      }}>
                        <span className="flex items-center justify-end gap-1">
                          Hours <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProjects.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.hours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Detailed Time Entries</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <DetailHead label="Project" field="project" />
                    <DetailHead label="Year" field="year" />
                    <DetailHead label="Category" field="category" />
                    <DetailHead label="User" field="user" />
                    <DetailHead label="Hours" field="hours" right />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.project}</TableCell>
                      <TableCell>{r.year}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{r.user}</TableCell>
                      <TableCell className="text-right">{r.hours}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

export default function ExternalTeams() {
  const { data: projects = [] } = useProjects();
  const { data: entries = [] } = useTimeEntries();

  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);

  const years = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p: any) => {
      if (p.reporting_year) set.add(clean(p.reporting_year));
    });
    return [...set].sort();
  }, [projects]);

  const allLegalRows = useMemo(() => buildTeamRows(entries, projectMap, "legal"), [entries, projectMap]);
  const allCqoRows = useMemo(() => buildTeamRows(entries, projectMap, "cqo"), [entries, projectMap]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Other External Teams</h1>
        <p className="text-muted-foreground">Legal and CQO effort across projects and reporting years.</p>
      </div>

      <TeamSection title="Legal Team" rows={allLegalRows} color="hsl(var(--chart-2))" years={years} />
      <TeamSection title="CQO Team" rows={allCqoRows} color="hsl(var(--chart-4))" years={years} />
    </div>
  );
}
