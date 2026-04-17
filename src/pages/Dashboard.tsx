import { useMemo, type ReactNode } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { selectDashboardModel } from "@/lib/analytics/selectors";

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-3xl font-bold">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const model = useMemo(() => (snapshot ? selectDashboardModel(snapshot) : null), [snapshot]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading canonical analytics snapshot...</div>;
  }

  if (!model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Upload Legacy, Modern, Time Log, and SME files to build the canonical analytics snapshot.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Canonical project metrics come from the unioned project registry. Logged effort is shown separately from project totals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Projects" value={model.cards.totalProjects} />
        <MetricCard label="Active Projects" value={model.cards.activeProjects} />
        <MetricCard label="Completed / Published" value={model.cards.completedPublishedProjects} />
        <MetricCard label="Project Hours" value={`${model.cards.totalProjectHours}h`} hint="From Legacy + Modern project totals" />
        <MetricCard label="Logged Hours" value={`${model.cards.totalLoggedHours}h`} hint="From transactional time logs only" />
        <MetricCard label="Standalone Course Hours" value={`${model.cards.standaloneHours}h`} />
        <MetricCard label="Operational Work Hours" value={`${model.cards.operationalHours}h`} />
        <MetricCard
          label="Discrepancy Flags"
          value={model.cards.discrepancyCount}
          hint={`${model.cards.discrepancyRate}% of canonical projects`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Projects by Reporting Year">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.projectsByReportingYear}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Active Projects by Status">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.activeProjectsByStatus} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="status" width={180} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Project Mix by Course Type">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={model.projectMixByCourseType} dataKey="value" nameKey="label" outerRadius={110} label>
                  {model.projectMixByCourseType.map((entry, index) => (
                    <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Project Mix by Authoring Tool">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.projectMixByAuthoringTool} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={140} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Hours by Time-Log Phase">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.hoursByTimeLogPhase}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Hours by Role Group">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.hoursByRoleGroup}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="roleGroup" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
