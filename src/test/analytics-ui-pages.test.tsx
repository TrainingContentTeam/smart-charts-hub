// @vitest-environment jsdom

import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import Development from "@/pages/Development";
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

import { useAnalyticsSnapshot } from "@/hooks/use-analytics-snapshot";
import { useAuth } from "@/hooks/use-auth";

const mockedUseAnalyticsSnapshot = vi.mocked(useAnalyticsSnapshot);
const mockedUseAuth = vi.mocked(useAuth);

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
  } as ReturnType<typeof useAuth>);
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

  it("renders project links on Projects, Development, SME Collaboration, and discrepancy surfaces", () => {
    const { unmount: unmountProjects } = renderWithRouter(
      <Routes>
        <Route path="/projects" element={<Projects />} />
      </Routes>,
      ["/projects"],
    );
    expect(screen.getByRole("link", { name: "Alpha Project" })).toHaveAttribute("href", "/projects/2026/alpha-project");
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

    renderWithRouter(
      <Routes>
        <Route path="/reconciliation" element={<Reconciliation />} />
      </Routes>,
      ["/reconciliation"],
    );
    fireEvent.click(screen.getByRole("tab", { name: "Discrepancies" }));
    expect(screen.getByRole("link", { name: "Alpha Project" })).toBeInTheDocument();
  });

  it("renders grouped reconciliation controls with accessible labels and tooltips", async () => {
    renderWithRouter(
      <Routes>
        <Route path="/reconciliation" element={<Reconciliation />} />
      </Routes>,
      ["/reconciliation"],
    );

    expect(screen.getByRole("heading", { name: "Alpha Project Video" })).toBeInTheDocument();
    const acceptButton = screen.getByRole("button", { name: "Accept Suggested Match" });
    expect(screen.getByRole("button", { name: "Standalone (Single Video / Other)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Non-Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Defer" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /select group alpha project video/i })).toBeInTheDocument();
    expect(acceptButton).toBeEnabled();
  });
});
