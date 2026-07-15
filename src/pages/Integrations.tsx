import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Cable, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface WrikeStatus {
  connected: boolean;
  status: "connected" | "error" | "disconnected";
  wrikeHost: string | null;
  scope: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not run yet";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export default function Integrations() {
  const { session } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<WrikeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.access_token;

  const loadStatus = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wrike/status", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setStatus((await response.json()) as WrikeStatus);
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : "Unable to load Wrike status.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wrikeResult = params.get("wrike");

    if (wrikeResult === "connected") {
      toast({
        title: "Wrike connected",
        description: "The Wrike OAuth connection was saved successfully.",
      });
      loadStatus();
    }

    if (wrikeResult === "error") {
      toast({
        title: "Wrike connection failed",
        description: "The authorization could not be completed. Check the server logs for details.",
        variant: "destructive",
      });
      loadStatus();
    }

    if (wrikeResult) {
      params.delete("wrike");
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : "",
        },
        { replace: true },
      );
    }
  }, [loadStatus, location.pathname, location.search, navigate, toast]);

  const connectionLabel = useMemo(() => {
    if (loading) return "Checking status";
    if (error) return "Status unavailable";
    if (status?.connected) return "Connected";
    return "Not connected";
  }, [error, loading, status?.connected]);

  const handleConnect = async () => {
    if (!accessToken) {
      toast({
        title: "Session unavailable",
        description: "Sign in again before connecting Wrike.",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);

    try {
      const response = await fetch("/api/wrike/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as { authorizationUrl?: string };

      if (!data.authorizationUrl) {
        throw new Error("Wrike authorization URL was not returned.");
      }

      window.location.assign(data.authorizationUrl);
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : "Unable to start Wrike authorization.";
      toast({
        title: "Unable to connect Wrike",
        description: message,
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Cable className="h-7 w-7" />
          Integrations
        </h1>
        <p className="text-muted-foreground">Manage secure connections for external source systems.</p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Cable className="h-5 w-5" />
                Wrike
              </CardTitle>
              <CardDescription>
                Read-only Wrike access for future project, course, and time-entry synchronization.
              </CardDescription>
            </div>
            <Badge variant={status?.connected ? "default" : "secondary"} className="w-fit">
              {loading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {connectionLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unable to check Wrike status</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status?.connected ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Data center host</p>
                <p className="mt-1 break-words text-sm font-medium">{status.wrikeHost}</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Permission</p>
                <p className="mt-1 text-sm font-medium">{status.scope || "wsReadOnly"}</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Connected</p>
                <p className="mt-1 text-sm font-medium">{formatDateTime(status.connectedAt)}</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">Last data sync</p>
                <p className="mt-1 text-sm font-medium">{formatDateTime(status.lastSyncAt)}</p>
              </div>
            </div>
          ) : (
            <Alert>
              <Cable className="h-4 w-4" />
              <AlertTitle>Wrike is not connected</AlertTitle>
              <AlertDescription>
                Authorize Wrike when the app registration and Vercel environment variables are ready.
              </AlertDescription>
            </Alert>
          )}

          {status?.lastError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Last connection error</AlertTitle>
              <AlertDescription>{status.lastError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
              <p>
                Wrike credentials are encrypted on the server and never sent to the browser. Upload Data stays available
                for datasets without API connections.
              </p>
            </div>
            <Button onClick={handleConnect} disabled={loading || connecting} className="shrink-0">
              {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {status?.connected ? "Reconnect Wrike" : "Connect Wrike"}
            </Button>
          </div>

          <a
            href="https://developers.wrike.com/docs/oauth-20-authorization"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Wrike OAuth documentation
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
