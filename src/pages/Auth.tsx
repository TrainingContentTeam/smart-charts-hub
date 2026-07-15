import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, KeyRound, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "update-password";

const DEV_BYPASS_AUTH =
  import.meta.env.DEV && import.meta.env.MODE !== "test" && import.meta.env.VITE_BYPASS_AUTH === "true";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      navigate("/", { replace: true });
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const recoveryRequested =
      hashParams.get("type") === "recovery" || queryParams.get("mode") === "reset";
    const authError = hashParams.get("error_description") ?? queryParams.get("error_description");

    if (recoveryRequested) setMode("update-password");
    if (authError) {
      setError(authError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
        setError(null);
        return;
      }
      if (session && !recoveryRequested) navigate("/", { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !recoveryRequested) navigate("/", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const submitCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (DEV_BYPASS_AUTH) {
      navigate("/", { replace: true });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return;
    if (mode === "sign-up" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    resetMessages();

    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });

      if (error) {
        setError(error.message || "Unable to create the account");
      } else if (data.session) {
        navigate("/", { replace: true });
      } else {
        setNotice(`Check ${normalizedEmail} to confirm your account, then sign in.`);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) setError(error.message || "Email or password is incorrect");
    }

    setLoading(false);
  };

  const requestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading(true);
    resetMessages();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });

    if (error) {
      setError(error.message || "Unable to send the reset link");
    } else {
      setNotice(`A password reset link was sent to ${normalizedEmail}.`);
    }
    setLoading(false);
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    resetMessages();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message || "Unable to update the password");
      setLoading(false);
      return;
    }

    window.history.replaceState({}, document.title, "/auth");
    navigate("/", { replace: true });
  };

  const isCredentialMode = mode === "sign-in" || mode === "sign-up";
  const heading = mode === "update-password" ? "Choose a new password" : "Team Analytics";
  const description =
    mode === "forgot-password"
      ? "Enter your email to receive a password reset link"
      : mode === "update-password"
        ? "Use at least eight characters for your new password"
        : "Sign in to access the shared analytics workspace";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            {mode === "update-password" ? (
              <KeyRound className="h-10 w-10 text-primary" />
            ) : (
              <BarChart3 className="h-10 w-10 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">{heading}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive text-center" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-sm text-foreground text-center" role="status">
              {notice}
            </p>
          )}

          {isCredentialMode && (
            <Tabs value={mode} onValueChange={(value) => changeMode(value as AuthMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                <TabsTrigger value="sign-up">Create account</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {isCredentialMode && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <EmailField email={email} setEmail={setEmail} />
              <PasswordField
                id="password"
                label="Password"
                value={password}
                setValue={setPassword}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              />
              {mode === "sign-up" && (
                <PasswordField
                  id="confirm-password"
                  label="Confirm password"
                  value={confirmPassword}
                  setValue={setConfirmPassword}
                  autoComplete="new-password"
                />
              )}
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                <Mail className="h-4 w-4" />
                {loading ? "Please wait..." : mode === "sign-up" ? "Create account" : "Sign in"}
              </Button>
              {mode === "sign-in" && (
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => changeMode("forgot-password")}
                >
                  Forgot password?
                </Button>
              )}
            </form>
          )}

          {mode === "forgot-password" && (
            <form onSubmit={requestPasswordReset} className="space-y-4">
              <EmailField email={email} setEmail={setEmail} />
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? "Sending..." : "Send reset link"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => changeMode("sign-in")}>
                Back to sign in
              </Button>
            </form>
          )}

          {mode === "update-password" && (
            <form onSubmit={updatePassword} className="space-y-4">
              <PasswordField
                id="new-password"
                label="New password"
                value={password}
                setValue={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                id="confirm-new-password"
                label="Confirm new password"
                value={confirmPassword}
                setValue={setConfirmPassword}
                autoComplete="new-password"
              />
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmailField({ email, setEmail }: { email: string; setEmail: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Work email</Label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="name@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  setValue,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  setValue: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        minLength={8}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
      />
    </div>
  );
}
