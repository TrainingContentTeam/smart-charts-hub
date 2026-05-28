// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import Development from "@/pages/Development";
import ExternalTeams from "@/pages/ExternalTeams";
import PersonDetail from "@/pages/PersonDetail";
import ProjectDetail from "@/pages/ProjectDetail";
import Projects from "@/pages/Projects";
import Reconciliation from "@/pages/Reconciliation";
import SmeCollaboration from "@/pages/SmeCollaboration";
import { createUiSnapshot } from "@/test/fixtures/analytics-ui-fixture";

vi.mock("recharts", async () => {
  const React = await import("react");
  const MockContainer = ({ children, data }: { children?: ReactNode; data?: Array<Record<string, unknown>> }) => (
    <div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<Record<string, unknown>>, { __chartData: data })
          : child,
      )}
    </div>
  );
  const MockLeaf = () => null;
  const labelFor = (entry: Record<string, unknown>) =>
    String(entry.status || entry.year || entry.reportingYear || entry.label || entry.phase || entry.roleGroup || entry.owner || entry.user || entry.tool || entry.type || entry.date || "unknown");
  const MockBar = ({ __chartData, onClick }: { __chartData?: Array<Record<string, unknown>>; onClick?: (entry: Record<string, unknown>) => void }) => (
    <div>
      {(__chartData || []).map((entry, index) => (
        <button
          key={`${labelFor(entry)}-${index}`}
          type="button"
          aria-label={`chart-bar-${labelFor(entry)}`}
          onClick={() => onClick?.(entry)}
        />
      ))}
    </div>
  );
  const MockPie = ({ data, onClick }: { data?: Array<Record<string, unknown>>; onClick?: (entry: Record<string, unknown>) => void }) => (
    <div>
      {(data || []).map((entry, index) => (
        <button
          key={`${labelFor(entry)}-${index}`}
          type="button"
          aria-label={`chart-slice-${labelFor(entry)}`}
          onClick={() => onClick?.(entry)}
        />
      ))}
    </div>
  );
  const MockLine = ({ __chartData, onClick }: { __chartData?: Array<Record<string, unknown>>; onClick?: (entry: Record<string, unknown>) => void }) => (
    <div>
      {(__chartData || []).map((entry, index) => (
        <button
          key={`${labelFor(entry)}-${index}`}
          type="button"
          aria-label={`chart-line-${labelFor(entry)}`}
          onClick={() => onClick?.(entry)}
        />
      ))}
    </div>
  );

  return {
    ResponsiveContainer: MockContainer,
    BarChart: MockContainer,
    PieChart: MockContainer,
    LineChart: MockContainer,
    Bar: MockBar,
    Line: MockLine,
    Pie: MockPie,
    Cell: MockLeaf,
    CartesianGrid: MockLeaf,
    Tooltip: MockLeaf,
    XAxis: MockLeaf,
    YAxis: MockLeaf,
  };
});

vi.mock("@/hooks/use-analytics-snapshot", () => ({
  useAnalyticsSnapshot: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/analytics/persistence", () => ({
  upsertLocalCourseAlias: vi.fn().mockResolvedValue(undefined),
  upsertLocalSmeManualJoin: vi.fn().mockResolvedValue(undefined),
  upsertLocalWorkEntityDecision: vi.fn().mockResolvedValue(undefined),
  upsertSharedCourseAlias: vi.fn().mockResolvedValue(undefined),
  upsertSharedSmeManualJoin: vi.fn().mockResolvedValue(undefined),
  upsertSharedWorkEntityDecision: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { useAuth } from "@/hooks/use-auth";
import {
  upsertLocalCourseAlias,
  upsertLocalWorkEntityDecision,
  upsertSharedCourseAlias,
  upsertLocalSmeManualJoin,
  upsertSharedSmeManualJoin,
  upsertSharedWorkEntityDecision,
} from "@/lib/analytics/persistence";
import { toast } from "sonner";

const mockedUseAnalyticsSnapshot = vi.mocked(useAnalyticsSnapshot);
const mockedUseAuth = vi.mocked(useAuth);
const mockedUpsertLocalCourseAlias = vi.mocked(upsertLocalCourseAlias);
const mockedUpsertLocalWorkEntityDecision = vi.mocked(upsertLocalWorkEntityDecision);
const mockedUpsertSharedCourseAlias = vi.mocked(upsertSharedCourseAlias);
const mockedUpsertLocalSmeManualJoin = vi.mocked(upsertLocalSmeManualJoin);
const mockedUpsertSharedWorkEntityDecision = vi.mocked(upsertSharedWorkEntityDecision);
const mockedUpsertSharedSmeManualJoin = vi.mocked(upsertSharedSmeManualJoin);
const mockedToast = vi.mocked(toast);

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{`${location.pathname}${location.search}`}</div>;
}

function renderWithRouter(ui: ReactNode, initialEntries: string[], routes?: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={initialEntries}>
          {routes || ui}
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedUseAnalyticsSnapshot.mockReturnValue({
    data: createUiSnapshot(),
    isLoading: false,
  } as ReturnType<typeof useAnalyticsSnapshot>);
  mockedUseAuth.mockReturnValue({
    user: { id: "user-1", email: "analyst@example.com" },
    session: { user: { id: "user-1" } },
    loading: false,
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  mockedUpsertSharedCourseAlias.mockResolvedValue(undefined);
  mockedUpsertSharedWorkEntityDecision.mockResolvedValue(undefined);
  mockedUpsertSharedSmeManualJoin.mockResolvedValue(undefined);
  mockedUpsertLocalCourseAlias.mockResolvedValue(undefined);
  mockedUpsertLocalWorkEntityDecision.mockResolvedValue(undefined);
  mockedUpsertLocalSmeManualJoin.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("analytics UI pages", () => {
  it("renders the active project status mix donut on the dashboard", () => {
    renderWithRouter(
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>,
      ["/"],
    );

    expect(screen.getByText("Project Mix by Course Type")).toBeInTheDocument();
    expect(screen.getByText("Active Project Status Mix")).toBeInTheDocument();
  });

  it("removes the dashboard hours comparison chart and links active status bars to Projects", () => {
    renderWithRouter(
      <Routes>
        <Route path="/" element={<><Dashboard /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/"],
    );

    expect(screen.queryByText("Project Hours vs Logged Hours")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-LP Development" }));

    expect(screen.getByTestId("location-display").textContent).toBe("/projects?active=yes&status=LP+Development");
  });

  it("links project mix and reporting year chart elements to Projects filters", () => {
    const { unmount: unmountYear } = renderWithRouter(
      <Routes>
        <Route path="/" element={<><Dashboard /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-2026" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?year=2026");
    unmountYear();

    const { unmount: unmountType } = renderWithRouter(
      <Routes>
        <Route path="/" element={<><Dashboard /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-slice-New" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?type=New");
    unmountType();

    renderWithRouter(
      <Routes>
        <Route path="/" element={<><Dashboard /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-Rise" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?tool=Rise");
  });

  it("links time-log chart bars to matched-project filters", () => {
    const { unmount: unmountPhase } = renderWithRouter(
      <Routes>
        <Route path="/" element={<><Dashboard /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-Planning" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?timePhase=Planning");
    unmountPhase();

    renderWithRouter(
      <Routes>
        <Route path="/" element={<><Dashboard /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-ID" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?timeRole=ID");
  });

  it("syncs Projects search state to the URL", () => {
    renderWithRouter(
      <Routes>
        <Route path="/projects" element={<><Projects /><LocationDisplay /></>} />
      </Routes>,
      ["/projects"],
    );

    fireEvent.change(
      screen.getByPlaceholderText(/search by project name/i),
      { target: { value: "Alpha" } },
    );

    expect(screen.getByTestId("location-display").textContent).toContain("/projects?q=Alpha");
  });

  it("filters Projects by active state and matched time-log metadata from URL params", () => {
    const { unmount: unmountActive } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?active=yes"],
    );

    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beta Project" })).not.toBeInTheDocument();
    unmountActive();

    const { unmount: unmountPhase } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?timePhase=Production"],
    );

    expect(screen.getByRole("link", { name: "Beta Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alpha Project" })).not.toBeInTheDocument();
    unmountPhase();

    renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?timeRole=ID"],
    );

    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beta Project" })).not.toBeInTheDocument();
  });

  it("filters Projects by chart click-through URL params", () => {
    const { unmount: unmountProject } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?project=beta-project%7C2025"],
    );

    expect(screen.getByRole("button", { name: /project/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beta Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alpha Project" })).not.toBeInTheDocument();
    unmountProject();

    const { unmount: unmountTime } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?timeUser=Casey+SME&workScope=matched_project_work&timeStart=2025-11-12&timeEnd=2025-11-12"],
    );

    expect(screen.getByRole("link", { name: "Beta Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alpha Project" })).not.toBeInTheDocument();
    unmountTime();

    renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?smeId=Alex+Doe&smeInternal=Internal&smeStart=2026-03-08&smeEnd=2026-03-09"],
    );

    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beta Project" })).not.toBeInTheDocument();
  });

  it("filters Projects by style and length URL params", () => {
    const { unmount: unmountStyle } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?style=Scenario"],
    );

    expect(screen.getByRole("button", { name: /style/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /length/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beta Project" })).not.toBeInTheDocument();
    unmountStyle();

    const { unmount: unmountLength } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?length=2+hr"],
    );

    expect(screen.getByRole("link", { name: "Beta Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alpha Project" })).not.toBeInTheDocument();
    unmountLength();

    renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects?style=Scenario&length=1+hr"],
    );

    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beta Project" })).not.toBeInTheDocument();
  });

  it("renders active external-team project cards on Other External Teams", () => {
    const snapshot = createUiSnapshot();
    const base = snapshot.canonicalProjects[0];
    snapshot.canonicalProjects = [
      {
        ...base,
        project_key: "legal-project|2026",
        raw_course_name: "Legal Project",
        normalized_course_name: "Legal Project",
        compact_course_name: "legalproject",
        status: "Process Legal Review",
        raw_status: "Process Legal Review",
      },
      {
        ...base,
        project_key: "cqo-project|2026",
        raw_course_name: "CQO Project",
        normalized_course_name: "CQO Project",
        compact_course_name: "cqoproject",
        status: "CQO Review",
        raw_status: "CQO Review",
      },
      {
        ...base,
        project_key: "compliance-project|2026",
        raw_course_name: "Compliance Project",
        normalized_course_name: "Compliance Project",
        compact_course_name: "complianceproject",
        status: "Compliance Review",
        raw_status: "Compliance Review",
      },
      {
        ...base,
        project_key: "published-legal-project|2026",
        raw_course_name: "Published Legal Project",
        normalized_course_name: "Published Legal Project",
        compact_course_name: "publishedlegalproject",
        status: "Published",
        raw_status: "Published",
      },
    ];
    mockedUseAnalyticsSnapshot.mockReturnValue({
      data: snapshot,
      isLoading: false,
    } as ReturnType<typeof useAnalyticsSnapshot>);

    renderWithRouter(
      <Routes>
        <Route path="/external-teams" element={<ExternalTeams />} />
      </Routes>,
      ["/external-teams"],
    );

    expect(screen.getByText("Legal")).toBeInTheDocument();
    expect(screen.getByText("CQO")).toBeInTheDocument();
    expect(screen.getByText("Compliance (Policy)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Legal Project" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CQO Project" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compliance Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Published Legal Project" })).not.toBeInTheDocument();
  });

  it("links non-dashboard graph elements to Projects filters", async () => {
    const { unmount: unmountDevelopment } = renderWithRouter(
      <Routes>
        <Route path="/development" element={<><Development /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/development"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-LP Development" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?active=yes&status=LP+Development");
    unmountDevelopment();

    const { unmount: unmountExternal } = renderWithRouter(
      <Routes>
        <Route path="/external-teams" element={<><ExternalTeams /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/external-teams"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-Other/External" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?timeRole=Other%2FExternal");
    unmountExternal();

    const { unmount: unmountSme } = renderWithRouter(
      <Routes>
        <Route path="/sme-collaboration" element={<><SmeCollaboration /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/sme-collaboration"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-2026" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?smeFeedback=yes&year=2026");
    unmountSme();

    const { unmount: unmountProject } = renderWithRouter(
      <Routes>
        <Route path="/projects/:reportingYear/:projectSlug" element={<><ProjectDetail /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/projects/2026/alpha-project"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-bar-Planning" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?project=alpha-project%7C2026&timePhase=Planning");
    unmountProject();

    const { unmount: unmountTimeline } = renderWithRouter(
      <Routes>
        <Route path="/projects/:reportingYear/:projectSlug" element={<><ProjectDetail /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/projects/2026/alpha-project"],
    );

    fireEvent.click(screen.getByRole("button", { name: "chart-line-2026-03-01" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?project=alpha-project%7C2026&timeStart=2026-03-01&timeEnd=2026-03-01");
    unmountTimeline();

    renderWithRouter(
      <Routes>
        <Route path="/people/:personSlug" element={<><PersonDetail /><LocationDisplay /></>} />
        <Route path="/projects" element={<LocationDisplay />} />
      </Routes>,
      ["/people/alex-doe"],
    );

    const idTab = screen.getByRole("tab", { name: "ID" });
    fireEvent.pointerDown(idTab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(idTab, { button: 0, ctrlKey: false });
    fireEvent.click(idTab);
    await waitFor(() => expect(idTab).toHaveAttribute("aria-selected", "true"));
    fireEvent.click(screen.getByRole("button", { name: "chart-bar-LP Development" }));
    expect(screen.getByTestId("location-display").textContent).toBe("/projects?owner=Alex+Doe&status=LP+Development");
  });

  it("navigates from the project list to detail and back while preserving list state", () => {
    renderWithRouter(
      <Routes>
        <Route path="/projects" element={<><Projects /><LocationDisplay /></>} />
        <Route path="/projects/:reportingYear/:projectSlug" element={<><ProjectDetail /><LocationDisplay /></>} />
      </Routes>,
      ["/projects?q=Alpha&year=2026"],
    );

    fireEvent.click(screen.getByRole("link", { name: "Alpha Project" }));
    expect(screen.getByRole("heading", { name: "Alpha Project" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search by project name/i)).toHaveValue("Alpha");
    expect(screen.getByTestId("location-display").textContent).toContain("/projects?q=Alpha&year=2026");
  });

  it("renders project links on Projects, Development, and SME Collaboration surfaces", () => {
    const { unmount: unmountProjects } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects"],
    );
    expect(screen.getByRole("link", { name: "Alpha Project" })).toHaveAttribute("href", "/projects/2026/alpha-project");
    expect(screen.getAllByRole("link", { name: "Alex Doe" })[0]).toHaveAttribute("href", "/people/alex-doe");
    unmountProjects();

    const { unmount: unmountDevelopment } = renderWithRouter(
      <Routes>
        <Route path="/development" element={<Development />} />
      </Routes>,
      ["/development"],
    );
    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
    unmountDevelopment();

    const { unmount: unmountSme } = renderWithRouter(
      <Routes>
        <Route path="/sme-collaboration" element={<SmeCollaboration />} />
      </Routes>,
      ["/sme-collaboration"],
    );
    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
    unmountSme();
  });

  it("renders reconciliation groups collapsed by default and exposes searchable override controls when expanded", async () => {
    renderWithRouter(
      <Routes>
        <Route path="/reconciliation" element={<Reconciliation />} />
      </Routes>,
      ["/reconciliation"],
    );

    expect(screen.getByRole("button", { name: /alpha project video/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept Suggested Match" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /alpha project video/i }));

    const acceptButton = screen.getByRole("button", { name: "Accept Suggested Match" });
    expect(screen.getByRole("button", { name: "Standalone (Single Video / Other)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Non-Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Defer" })).toBeInTheDocument();
    expect(screen.getByText("Project Override")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /select group alpha project video/i })).toBeInTheDocument();
    expect(acceptButton).toBeEnabled();
  });

  it("hides a reconciled group immediately and shows a success toast after the action completes", async () => {
    renderWithRouter(
      <Routes>
        <Route path="/reconciliation" element={<Reconciliation />} />
      </Routes>,
      ["/reconciliation"],
    );

    fireEvent.click(screen.getByRole("button", { name: /alpha project video/i }));
    fireEvent.click(screen.getByRole("button", { name: "Accept Suggested Match" }));

    await waitFor(() => {
      expect(screen.queryByText("Alpha Project Video")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        mockedUpsertSharedCourseAlias.mock.calls.length + mockedUpsertLocalCourseAlias.mock.calls.length,
      ).toBeGreaterThan(0);
      expect(
        mockedUpsertSharedWorkEntityDecision.mock.calls.length + mockedUpsertLocalWorkEntityDecision.mock.calls.length,
      ).toBeGreaterThan(0);
      expect(mockedToast.success).toHaveBeenCalledWith("Matched to the suggested project.");
    });
  });

  it("lets development table filters and sorting work together", () => {
    const snapshot = createUiSnapshot();
    snapshot.canonicalProjects[1].status = "LP Development";
    snapshot.canonicalProjects[1].raw_status = "LP Development";
    mockedUseAnalyticsSnapshot.mockReturnValue({
      data: snapshot,
      isLoading: false,
    } as ReturnType<typeof useAnalyticsSnapshot>);

    renderWithRouter(
      <Routes>
        <Route path="/development" element={<Development />} />
      </Routes>,
      ["/development"],
    );

    fireEvent.change(screen.getByPlaceholderText(/search project, status, or owner/i), {
      target: { value: "Beta" },
    });

    expect(screen.getByRole("link", { name: "Beta Project" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alpha Project" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search project, status, or owner/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /latest time log/i }));

    const projectLinks = screen.getAllByRole("link", { name: /project/i });
    expect(projectLinks[0]).toHaveTextContent("Beta Project");
  });

  it("renders the SME matrix and matched-response person links", () => {
    renderWithRouter(
      <Routes>
        <Route path="/sme-collaboration" element={<SmeCollaboration />} />
      </Routes>,
      ["/sme-collaboration"],
    );

    expect(screen.getByText("SME Course Coverage")).toBeInTheDocument();
    expect(screen.getByText("ID Course Coverage")).toBeInTheDocument();
    expect(screen.getByText("SME Ratings From ID Surveys")).toBeInTheDocument();
    expect(screen.getByText("ID Ratings From SME Surveys")).toBeInTheDocument();
    expect(screen.getByText("Overall Experience with Lexipol")).toBeInTheDocument();
    expect(screen.getByText("Matched Responses")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Taylor SME" })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Alex Doe" })[0]).toBeInTheDocument();
  });

  it("navigates from a person link to the unified person detail page and back", () => {
    renderWithRouter(
      <Routes>
        <Route path="/sme-collaboration" element={<><SmeCollaboration /><LocationDisplay /></>} />
        <Route path="/people/:personSlug" element={<><PersonDetail /><LocationDisplay /></>} />
      </Routes>,
      ["/sme-collaboration?start=2026-03-01"],
    );

    fireEvent.click(screen.getAllByRole("link", { name: "Alex Doe" })[0]);
    expect(screen.getByRole("heading", { name: "Alex Doe" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("heading", { name: "SME Collaboration" })).toBeInTheDocument();
    expect(screen.getByTestId("location-display").textContent).toContain("/sme-collaboration?start=2026-03-01");
  });
});
