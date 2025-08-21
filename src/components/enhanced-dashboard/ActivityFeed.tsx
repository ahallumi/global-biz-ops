import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  Clock, 
  UserPlus, 
  Package, 
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'approval' | 'submission' | 'employee' | 'alert' | 'update';
  title: string;
  description?: string;
  timestamp: Date;
  status?: 'success' | 'warning' | 'info' | 'error';
  user?: string;
}

interface ActivityFeedProps {
  loading?: boolean;
  limit?: number;
}

export function ActivityFeed({ loading = false, limit = 10 }: ActivityFeedProps) {
  // Mock data - in real app this would come from API
  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'approval' as const,
      title: 'Intake #INK-2024-001 approved',
      description: 'Product intake for CED supplier',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'success' as const,
      user: 'John Smith'
    },
    {
      id: '2',
      type: 'employee' as const,
      title: 'New employee Sarah Johnson added',
      description: 'Role: Staff Member',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: 'info' as const,
      user: 'Admin'
    },
    {
      id: '3',
      type: 'update' as const,
      title: 'Supplier CED updated product catalog',
      description: '15 new products added',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'info' as const,
      user: 'System'
    },
    {
      id: '4',
      type: 'submission' as const,
      title: 'Intake #INK-2024-003 submitted',
      description: 'Awaiting review',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: 'warning' as const,
      user: 'Mike Davis'
    },
    {
      id: '5',
      type: 'alert' as const,
      title: 'Low inventory alert',
      description: 'Product ABC-123 below threshold',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      status: 'error' as const,
      user: 'System'
    }
  ].slice(0, limit);

  const getActivityIcon = (type: ActivityItem['type'], status?: ActivityItem['status']) => {
    switch (type) {
      case 'approval':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'submission':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'employee':
        return <UserPlus className="h-4 w-4 text-info" />;
      case 'update':
        return <Package className="h-4 w-4 text-info" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status?: ActivityItem['status']) => {
    if (!status) return null;

    const variants = {
      success: 'bg-success/10 text-success border-success/20',
      warning: 'bg-warning/10 text-warning border-warning/20',
      info: 'bg-info/10 text-info border-info/20',
      error: 'bg-destructive/10 text-destructive border-destructive/20'
    };

    return (
      <Badge variant="outline" className={variants[status]}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest updates and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded-full mt-1" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest updates and notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 group">
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type, activity.status)}
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">
                        {activity.title}
                      </p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                        </p>
                        {activity.user && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <p className="text-xs text-muted-foreground">
                              by {activity.user}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(activity.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}