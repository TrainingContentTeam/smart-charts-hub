// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "@/pages/Auth";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  unsubscribe: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
      updateUser: authMocks.updateUser,
    },
  },
}));

function renderAuth() {
  return render(
    <MemoryRouter>
      <Auth />
    </MemoryRouter>,
  );
}

function enterCredentials(email = "Person@Example.com", password = "password123") {
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/auth");
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    authMocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.updateUser.mockResolvedValue({ error: null });
  });

  it("signs in with normalized email and password", async () => {
    renderAuth();
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
        email: "person@example.com",
        password: "password123",
      });
    });
  });

  it("creates an account and requests email confirmation", async () => {
    renderAuth();
    const createAccountTab = screen.getByRole("tab", { name: "Create account" });
    fireEvent.pointerDown(createAccountTab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(createAccountTab, { button: 0, ctrlKey: false });
    fireEvent.click(createAccountTab);
    enterCredentials();
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(authMocks.signUp).toHaveBeenCalledWith({
        email: "person@example.com",
        password: "password123",
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Check person@example.com to confirm your account, then sign in.",
    );
  });

  it("sends a password reset email", async () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "Person@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
    });
  });

  it("updates the password after following a recovery link", async () => {
    window.history.replaceState({}, "", "/auth?mode=reset");
    renderAuth();

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "replacement123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "replacement123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(authMocks.updateUser).toHaveBeenCalledWith({ password: "replacement123" });
    });
  });
});
