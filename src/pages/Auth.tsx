import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, LogIn, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const DEV_BYPASS_AUTH =
  import.meta.env.DEV && import.meta.env.MODE !== "test" && import.meta.env.VITE_BYPASS_AUTH === "true";

export default function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      navigate("/", { replace: true });
      return;
    }

    const params = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.search,
    );
    const authError = params.get("error_description");
    if (authError) {
      setError(authError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/", { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signInWithGoogle = async () => {
    if (DEV_BYPASS_AUTH) {
      navigate("/", { replace: true });
      return;
    }

    setLoading("google");
    setError(null);
    setNotice(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });

    if (error) {
      setError(error.message || "Google sign-in failed");
      setLoading(null);
    }
  };

  const signInWithMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (DEV_BYPASS_AUTH) {
      navigate("/", { replace: true });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setLoading("email");
    setError(null);
    setNotice(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });

    if (error) {
      setError(error.message || "Unable to send the sign-in link");
    } else {
      setNotice(`A sign-in link was sent to ${normalizedEmail}.`);
    }
    setLoading(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <BarChart3 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Team Analytics</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to access the shared analytics workspace</p>
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

          <Button
            onClick={signInWithGoogle}
            disabled={loading !== null}
            className="w-full"
            size="lg"
          >
            <LogIn className="h-4 w-4" />
            {loading === "google" ? "Connecting..." : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={signInWithMagicLink} className="space-y-3">
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
            <Button type="submit" variant="outline" disabled={loading !== null} className="w-full">
              <Mail className="h-4 w-4" />
              {loading === "email" ? "Sending..." : "Email me a sign-in link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
