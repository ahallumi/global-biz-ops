import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useStationSession } from '@/hooks/useStationSession';

function importTokenFromHashOnce() {
  const hash = window.location.hash; // e.g., "#st=eyJhbGciOi..."
  if (!hash || hash.length < 4) return;

  // Support additional params later like "#st=...&x=y"
  const params = new URLSearchParams(hash.slice(1));
  const st = params.get("st");
  if (!st) return;

  // Persist for the guard to use
  sessionStorage.setItem("station_jwt", decodeURIComponent(st));

  // Remove token from the URL bar immediately (no reload)
  const clean = window.location.pathname + window.location.search;
  history.replaceState(null, "", clean);
}

interface StationRouteProps {
  children: ReactNode;
}

export function StationRoute({ children }: StationRouteProps) {
  // Import token from URL fragment before session check
  useEffect(() => {
    importTokenFromHashOnce();
  }, []);

  const { loading, authenticated } = useStationSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-center">
          <div className="h-8 w-32 bg-muted rounded mb-4 mx-auto"></div>
          <div className="h-4 w-48 bg-muted rounded mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking station access...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/station-login" replace />;
  }

  return <>{children}</>;
}