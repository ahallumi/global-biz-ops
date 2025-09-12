import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useStationSession } from '@/hooks/useStationSession';

interface StationRouteProps {
  children: ReactNode;
}

export function StationRoute({ children }: StationRouteProps) {
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