import { useMemo, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { selectSmeCollaborationModel } from "@/lib/analytics/selectors";

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

export default function SmeCollaboration() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const model = useMemo(() => (snapshot ? selectSmeCollaborationModel(snapshot) : null), [snapshot]);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading SME collaboration model...</div>;
  }

  if (!model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No SME feedback rows are available yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SME Collaboration</h1>
        <p className="text-muted-foreground">
          ID-facing collaboration ratings and SME-facing Lexipol experience ratings are modeled as separate datasets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ChartCard title="Response Count">
          <p className="text-4xl font-bold">{model.cards.responseCount}</p>
        </ChartCard>
        <ChartCard title="Avg Overall Collaboration Rating (ID View)">
          <p className="text-4xl font-bold">{model.cards.averageOverallCollaborationRating || "-"}</p>
        </ChartCard>
        <ChartCard title="Avg Promoter Score (ID View)">
          <p className="text-4xl font-bold">{model.cards.averagePromoterScore || "-"}</p>
        </ChartCard>
        <ChartCard title="Unresolved / Ambiguous SME Rows">
          <p className="text-4xl font-bold">{model.cards.unresolvedRowsCount}</p>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="SME Satisfaction by Question (SME View)">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.averageSmeQuestionScores} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 5]} />
                <YAxis type="category" dataKey="question" width={220} />
                <Tooltip />
                <Bar dataKey="average" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Responses by Reporting Year">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.byReportingYear}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="reportingYear" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="responses" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ID → SME Evaluation Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructional Designer</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Avg Rating</TableHead>
                  <TableHead>Avg Promoter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.byInstructionalDesigner.map((row) => (
                  <TableRow key={row.instructionalDesigner}>
                    <TableCell>{row.instructionalDesigner}</TableCell>
                    <TableCell>{row.responses}</TableCell>
                    <TableCell>{row.averageRating || "-"}</TableCell>
                    <TableCell>{row.averagePromoter || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">SME → Lexipol Experience Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SME</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Avg Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.bySme.map((row) => (
                  <TableRow key={row.sme}>
                    <TableCell>{row.sme}</TableCell>
                    <TableCell>{row.responses}</TableCell>
                    <TableCell>{row.averageScore || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matched Responses by Project</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Key</TableHead>
                <TableHead>Responses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.byProject.map((row) => (
                <TableRow key={row.projectKey}>
                  <TableCell>{row.projectKey}</TableCell>
                  <TableCell>{row.responses}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
