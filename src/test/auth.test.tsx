// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "@/pages/Auth";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signInWithOAuth: authMocks.signInWithOAuth,
      signInWithOtp: authMocks.signInWithOtp,
    },
  },
}));

describe("Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/auth");
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.signInWithOAuth.mockResolvedValue({ error: null });
    authMocks.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("starts Google OAuth through the configured Supabase client", async () => {
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
    });
  });

  it("sends a normalized email magic link and confirms delivery", async () => {
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "  Person@Example.com  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

    await waitFor(() => {
      expect(authMocks.signInWithOtp).toHaveBeenCalledWith({
        email: "person@example.com",
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "A sign-in link was sent to person@example.com.",
    );
  });
});
