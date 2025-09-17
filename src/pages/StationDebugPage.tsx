import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StationDebugPage() {
  const [bearerResult, setBearerResult] = useState<any>(null);
  const [cookieResult, setCookieResult] = useState<any>(null);
  const [whoAmIBearer, setWhoAmIBearer] = useState<any>(null);
  const [whoAmICookie, setWhoAmICookie] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Station Session Debug";
  }, []);

  const checkBearer = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = sessionStorage.getItem("station_jwt");
      if (!token) {
        setError("No station_jwt found in sessionStorage.");
        setBearerResult(null);
        return;
      }
      const res = await fetch(
        "https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/station-session",
        {
          method: "GET",
          credentials: "include",
            headers: {
              Authorization: `Bearer ${token}`,
            },
        }
      );
      const data = await res.json().catch(() => ({}));
      setBearerResult({ status: res.status, ok: res.ok, data });
    } catch (e) {
      setError("Bearer check failed: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const checkCookie = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        "https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/station-session",
        {
          method: "GET",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      setCookieResult({ status: res.status, ok: res.ok, data });
    } catch (e) {
      setError("Cookie check failed: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const whoAmIBearerCheck = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = sessionStorage.getItem("station_jwt");
      if (!token) {
        setWhoAmIBearer({ error: "No station_jwt in sessionStorage" });
        return;
      }
      const res = await fetch(
        "https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/__whoami",
        {
          method: "GET",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json().catch(() => ({}));
      setWhoAmIBearer({ status: res.status, ok: res.ok, data });
    } catch (e) {
      setError("WhoAmI Bearer failed: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const whoAmICookieCheck = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        "https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/__whoami",
        {
          method: "GET",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      setWhoAmICookie({ status: res.status, ok: res.ok, data });
    } catch (e) {
      setError("WhoAmI Cookie failed: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const doLogout = async () => {
    setError(null);
    setLoading(true);
    try {
      await fetch(
        "https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/station-logout",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (e) {
      setError("Logout failed: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clearToken = () => {
    sessionStorage.removeItem("station_jwt");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Station Session Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={checkBearer} disabled={loading}>
              Check Bearer
            </Button>
            <Button variant="outline" onClick={checkCookie} disabled={loading}>
              Check Cookie
            </Button>
            <Button variant="secondary" onClick={doLogout} disabled={loading}>
              Logout (Cookie)
            </Button>
            <Button variant="ghost" onClick={clearToken} disabled={loading}>
              Clear Token (sessionStorage)
            </Button>
            <Button variant="secondary" onClick={whoAmIBearerCheck} disabled={loading}>
              WhoAmI (Bearer)
            </Button>
            <Button variant="secondary" onClick={whoAmICookieCheck} disabled={loading}>
              WhoAmI (Cookie)
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="font-semibold mb-2">Bearer Result</h2>
              <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-80">
{JSON.stringify(bearerResult, null, 2)}
              </pre>
            </div>
            <div>
              <h2 className="font-semibold mb-2">Cookie Result</h2>
              <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-80">
{JSON.stringify(cookieResult, null, 2)}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="font-semibold mb-2">WhoAmI (Bearer)</h2>
              <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-80">
{JSON.stringify(whoAmIBearer, null, 2)}
              </pre>
            </div>
            <div>
              <h2 className="font-semibold mb-2">WhoAmI (Cookie)</h2>
              <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-80">
{JSON.stringify(whoAmICookie, null, 2)}
              </pre>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => (window.location.href = "/station-login")}>Go to Station Login</Button>
            <Button onClick={() => (window.location.href = "/station")}>Go to Station</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
