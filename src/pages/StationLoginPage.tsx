import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStationSession } from "@/hooks/useStationSession";

export default function StationLoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { authenticated } = useStationSession();

  // Redirect if already authenticated
  useEffect(() => {
    if (authenticated) {
      navigate('/station', { replace: true });
    }
  }, [authenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanCode = code.replace(/\s/g, '').toUpperCase();
      
      if (cleanCode.length !== 12) {
        setError("Access code must be exactly 12 characters");
        setLoading(false);
        return;
      }

      const response = await fetch('https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: cleanCode })
      });

      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      
      // Accept success either by HTTP status or explicit flags
      if (response.ok && data?.token) {
        const token = data.token as string;
        const target = data.redirectTo || '/station';
        
        // Build absolute URL (covers path-only and absolute URLs)
        const url = new URL(target, window.location.origin);
        
        // Put token in the fragment (not query!) so it never hits server logs
        url.hash = `st=${encodeURIComponent(token)}`;
        
        console.log('Login successful, redirecting with token handoff to:', target);
        
        // Use replace() so Back doesn't expose the tokened URL
        window.location.replace(url.toString());
      } else {
        const errorMsg = data?.error || `Login failed (${response.status})`;
        setError(errorMsg);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatCode = (value: string) => {
    // Remove any non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Limit to 12 characters
    return cleaned.slice(0, 12);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Station Access</CardTitle>
          <p className="text-muted-foreground">Enter your 12-character access code</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Access Code
              </label>
              <Input
                id="code"
                value={code}
                onChange={handleCodeChange}
                className="text-center font-mono text-lg tracking-wider"
                placeholder="A1B2C3D4E5F6"
                autoFocus
                autoComplete="off"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground text-center">
                {code.length}/12 characters
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || code.length !== 12}
            >
              {loading ? "Authenticating..." : "Access Station"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}