import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartPanel } from "@/components/ChartPanel";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { getSmeInternalLabel, selectSmeCollaborationModel } from "@/lib/analytics/selectors";

function toOptions(values: string[]): CompactFilterOption[] {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function SmeCollaboration() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const [internalValues, setInternalValues] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const model = useMemo(
    () =>
      snapshot
        ? selectSmeCollaborationModel(snapshot, {
            internalValues,
            startDate: startDate || null,
            endDate: endDate || null,
          })
        : null,
    [endDate, internalValues, snapshot, startDate],
  );

  const internalOptions = useMemo(
    () => (snapshot ? toOptions(snapshot.smeFeedbackSmeView.map((row) => getSmeInternalLabel(row.internal))) : []),
    [snapshot],
  );

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
          Instructional designer collaboration feedback and SME experience feedback stay separate, while filters help narrow the view without collapsing the two instruments together.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <CompactMultiSelectFilter label="Internal" options={internalOptions} selected={internalValues} onChange={setInternalValues} />
          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Start Date</span>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-[180px]" />
          </div>
          <div className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">End Date</span>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-[180px]" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Response Count" value={model.cards.responseCount} />
        <SummaryCard label="Avg Collaboration Rating" value={model.cards.averageOverallCollaborationRating || "-"} />
        <SummaryCard label="Avg Promoter Score" value={model.cards.averagePromoterScore || "-"} />
        <SummaryCard label="Unresolved / Ambiguous Rows" value={model.cards.unresolvedRowsCount} />
      </div>

      <ChartPanel title="SME Satisfaction by Question (SME View)">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.averageSmeQuestionScores} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 5]} />
              <YAxis type="category" dataKey="label" width={260} />
              <Tooltip />
              <Bar dataKey="average" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <ChartPanel title="Responses by Reporting Year">
        <div className="h-[320px]">
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
      </ChartPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          <CardTitle className="text-base">Matched Responses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>SME Response</TableHead>
                <TableHead>Designer Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.matchedResponses.map((row) => (
                <TableRow key={row.rawSmeFeedbackRowId}>
                  <TableCell>
                    <ProjectLink projectName={row.projectName} reportingYear={row.reportingYear}>
                      {row.projectName}
                    </ProjectLink>
                  </TableCell>
                  <TableCell>{row.reportingYear}</TableCell>
                  <TableCell>{row.smeResponse || "-"}</TableCell>
                  <TableCell>{row.designerComments || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
