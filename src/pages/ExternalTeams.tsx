import { useMemo, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { selectExternalTeamsModel } from "@/lib/analytics/selectors";

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

export default function ExternalTeams() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const model = useMemo(() => (snapshot ? selectExternalTeamsModel(snapshot) : null), [snapshot]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading external team analytics...</div>;
  }

  if (!model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No external-team time log data is available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">External Teams</h1>
        <p className="text-muted-foreground">
          External work is modeled from time logs plus work-entity classification, not inferred from project status alone.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Hours by External Role Group">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.hoursByExternalRoleGroup}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="roleGroup" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Hours by Category Phase">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.hoursByCategoryPhase}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="phase" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Non-Project / Standalone Work Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Item</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.topWorkItems.map((row) => (
                  <TableRow key={row.workItem}>
                    <TableCell>{row.workItem}</TableCell>
                    <TableCell>{row.hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.usersByHours.map((row) => (
                  <TableRow key={row.user}>
                    <TableCell>{row.user}</TableCell>
                    <TableCell>{row.hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
