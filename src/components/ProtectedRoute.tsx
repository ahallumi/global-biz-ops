import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: Array<'admin' | 'staff' | 'manager'>;
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, employee, loading, actingAsStaff } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded mb-4"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRoles && employee && !requiredRoles.includes(employee.role)) {
    // Special case: Allow admin to access staff dashboard if acting as staff
    if (requiredRoles.includes('staff') && employee.role === 'admin' && actingAsStaff) {
      return <>{children}</>;
    }
    
    // Redirect to appropriate login based on required role
    if (requiredRoles.includes('staff')) {
      return <Navigate to="/staff-login" replace />;
    } else if (requiredRoles.includes('admin') || requiredRoles.includes('manager')) {
      return <Navigate to="/admin-login" replace />;
    } else {
      return <Navigate to="/auth" replace />;
    }
  }

  return <>{children}</>;
}