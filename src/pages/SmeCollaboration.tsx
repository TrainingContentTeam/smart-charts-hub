import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartPanel } from "@/components/ChartPanel";
import { CompactMultiSelectFilter, type CompactFilterOption } from "@/components/CompactMultiSelectFilter";
import { PersonLink } from "@/components/PersonLink";
import { ProjectLink } from "@/components/ProjectLink";
import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { getSmeInternalLabel, selectSmeCollaborationModel } from "@/lib/analytics/selectors";

function toOptions(values: string[]): CompactFilterOption[] {
  return values.map((value) => ({ label: value, value }));
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

function HeatCell({
  value,
  maxValue,
}: {
  value: number;
  maxValue: number;
}) {
  const opacity = maxValue > 0 ? Math.max(0.12, value / maxValue) : 0.08;

  return (
    <TableCell
      className="text-center font-medium"
      style={{ backgroundColor: `hsl(var(--chart-1) / ${opacity})` }}
    >
      {value || "-"}
    </TableCell>
  );
}

export default function SmeCollaboration() {
  const { data: snapshot, isLoading } = useAnalyticsSnapshot();
  const [internalValues, setInternalValues] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchedSmes, setMatchedSmes] = useState<string[]>([]);
  const [matchedYears, setMatchedYears] = useState<string[]>([]);

  const model = useMemo(
    () =>
      snapshot
        ? selectSmeCollaborationModel(snapshot, {
            internalValues,
            startDate: startDate || null,
            endDate: endDate || null,
            matchedResponses: {
              instructionalDesigners: matchedIds,
              smes: matchedSmes,
              reportingYears: matchedYears,
            },
          })
        : null,
    [endDate, internalValues, matchedIds, matchedSmes, matchedYears, snapshot, startDate],
  );

  const internalOptions = useMemo(
    () =>
      snapshot
        ? toOptions(
            [...new Set(snapshot.smeFeedbackSmeView.map((row) => getSmeInternalLabel(row.internal)))].sort((a, b) => a.localeCompare(b)),
          )
        : [],
    [snapshot],
  );

  const maxMatrixCount = useMemo(
    () => Math.max(0, ...(model?.smeQuestionMatrix.flatMap((row) => Object.values(row.counts)) || [0])),
    [model],
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead className="text-center">1</TableHead>
              <TableHead className="text-center">2</TableHead>
              <TableHead className="text-center">3</TableHead>
              <TableHead className="text-center">4</TableHead>
              <TableHead className="text-center">5</TableHead>
              <TableHead className="text-center">Responses</TableHead>
              <TableHead className="text-center">Average</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.smeQuestionMatrix.map((row) => (
              <TableRow key={row.question}>
                <TableCell className="min-w-[280px] font-medium">{row.label}</TableCell>
                <HeatCell value={row.counts[1]} maxValue={maxMatrixCount} />
                <HeatCell value={row.counts[2]} maxValue={maxMatrixCount} />
                <HeatCell value={row.counts[3]} maxValue={maxMatrixCount} />
                <HeatCell value={row.counts[4]} maxValue={maxMatrixCount} />
                <HeatCell value={row.counts[5]} maxValue={maxMatrixCount} />
                <TableCell className="text-center">{row.responseCount || "-"}</TableCell>
                <TableCell className="text-center font-semibold">{row.average || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
        <ChartPanel
          title="ID → SME Evaluation Breakdown"
          info="These scores come from the instructional designer survey and reflect the ID’s evaluation of the SME."
        >
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
                  <TableCell>
                    <PersonLink personName={row.instructionalDesigner}>{row.instructionalDesigner}</PersonLink>
                  </TableCell>
                  <TableCell>{row.responses}</TableCell>
                  <TableCell>{row.averageRating || "-"}</TableCell>
                  <TableCell>{row.averagePromoter || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ChartPanel>

        <ChartPanel
          title="SME → Lexipol Experience Breakdown"
          info="These scores come from the SME-facing survey and reflect the SME’s review of the Lexipol experience."
        >
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
                  <TableCell>
                    <PersonLink personName={row.sme}>{row.sme}</PersonLink>
                  </TableCell>
                  <TableCell>{row.responses}</TableCell>
                  <TableCell>{row.averageScore || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ChartPanel>
      </div>

      <ChartPanel
        title="Matched Responses"
        filters={
          <>
            <CompactMultiSelectFilter
              label="ID"
              options={toOptions(model.matchedResponseFilterOptions.instructionalDesigners)}
              selected={matchedIds}
              onChange={setMatchedIds}
            />
            <CompactMultiSelectFilter
              label="SME"
              options={toOptions(model.matchedResponseFilterOptions.smes)}
              selected={matchedSmes}
              onChange={setMatchedSmes}
            />
            <CompactMultiSelectFilter
              label="Year"
              options={toOptions(model.matchedResponseFilterOptions.reportingYears)}
              selected={matchedYears}
              onChange={setMatchedYears}
            />
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Instructional Designer</TableHead>
              <TableHead>SME</TableHead>
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
                <TableCell>
                  <PersonLink personName={row.instructionalDesigner}>{row.instructionalDesigner}</PersonLink>
                </TableCell>
                <TableCell>
                  <PersonLink personName={row.sme}>{row.sme}</PersonLink>
                </TableCell>
                <TableCell>{row.smeResponse || "-"}</TableCell>
                <TableCell>{row.designerComments || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartPanel>
    </div>
  );
}
