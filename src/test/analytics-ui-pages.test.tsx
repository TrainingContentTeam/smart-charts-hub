// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import Development from "@/pages/Development";
import PersonDetail from "@/pages/PersonDetail";
import ProjectDetail from "@/pages/ProjectDetail";
import Projects from "@/pages/Projects";
import Reconciliation from "@/pages/Reconciliation";
import SmeCollaboration from "@/pages/SmeCollaboration";
import { createUiSnapshot } from "@/test/fixtures/analytics-ui-fixture";

vi.mock("recharts", async () => {
  const MockContainer = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const MockLeaf = () => null;

  return {
    ResponsiveContainer: MockContainer,
    BarChart: MockContainer,
    PieChart: MockContainer,
    LineChart: MockContainer,
    Bar: MockLeaf,
    Line: MockLeaf,
    Pie: MockLeaf,
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
