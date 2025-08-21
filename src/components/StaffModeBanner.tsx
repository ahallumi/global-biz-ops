import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

export function StaffModeBanner() {
  const { employee, actingAsStaff, exitStaffMode } = useAuth();
  
  if (!(employee?.role === 'admin' && actingAsStaff)) {
    return null;
  }

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/30 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Acting as Staff
          </span>
          <span className="text-xs text-amber-700 dark:text-amber-300">
            You're viewing the staff portal as an admin. Some admin-only features are hidden.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={exitStaffMode}
          className="text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 h-8 px-3"
        >
          <X className="h-3 w-3 mr-1" />
          Exit Staff Mode
        </Button>
      </div>
    </div>
  );
}