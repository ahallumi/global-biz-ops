import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStationSession } from '@/hooks/useStationSession';

interface SessionAwareRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireStation?: boolean;
}

export function SessionAwareRoute({ children, requireAdmin, requireStation }: SessionAwareRouteProps) {
  const { user, employee, loading: authLoading } = useAuth();
  const { authenticated: stationAuth, loading: stationLoading } = useStationSession();

  const loading = authLoading || stationLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-center">
          <div className="h-8 w-32 bg-muted rounded mb-4 mx-auto"></div>
          <div className="h-4 w-48 bg-muted rounded mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  // Check for admin access
  if (requireAdmin) {
    if (!user || !employee || employee.role !== 'admin') {
      return <Navigate to="/admin-login" replace />;
    }
    return <>{children}</>;
  }

  // Check for station access
  if (requireStation) {
    if (!stationAuth) {
      return <Navigate to="/station-login" replace />;
    }
    return <>{children}</>;
  }

  // Default: allow any authenticated user
  if (!user && !stationAuth) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}