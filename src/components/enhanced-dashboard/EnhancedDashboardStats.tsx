import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  action?: {
    label: string;
    onClick: () => void;
  };
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
  variant = 'default',
  action,
  loading = false
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-success" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-destructive" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    
    switch (trend.direction) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-success/20 bg-success/5';
      case 'warning':
        return 'border-warning/20 bg-warning/5';
      case 'destructive':
        return 'border-destructive/20 bg-destructive/5';
      default:
        return 'border-border bg-card';
    }
  };

  if (loading) {
    return (
      <Card className={getVariantStyles()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`transition-colors hover:border-primary/20 ${getVariantStyles()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-bold">{value}</div>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="font-medium">{trend.value}%</span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action && (
            <Button variant="ghost" size="icon" onClick={action.onClick} className="h-8 w-8">
              <ArrowUpRight className="h-3 w-3" />
              <span className="sr-only">{action.label}</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface EnhancedDashboardStatsProps {
  isAdmin?: boolean;
  loading?: boolean;
}

export function EnhancedDashboardStats({ isAdmin = false, loading = false }: EnhancedDashboardStatsProps) {
  // Mock data - in real app this would come from API
  const stats = [
    {
      title: 'Active Intakes',
      value: 12,
      trend: { value: 16.7, label: 'from yesterday', direction: 'up' as const },
      icon: TrendingUp,
      variant: 'success' as const,
    },
    ...(isAdmin ? [
      {
        title: 'Pending Reviews',
        value: 8,
        description: 'Awaiting approval',
        icon: TrendingDown,
        variant: 'warning' as const,
        action: { label: 'Review', onClick: () => console.log('Navigate to reviews') }
      },
      {
        title: 'Total Products',
        value: 156,
        trend: { value: 2.3, label: 'this month', direction: 'up' as const },
        description: 'Across all suppliers',
        icon: TrendingUp,
      },
      {
        title: 'Team Members',
        value: 24,
        trend: { value: 0, label: 'no change', direction: 'neutral' as const },
        description: 'Active employees',
        icon: TrendingUp,
      }
    ] : [])
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} loading={loading} />
      ))}
    </div>
  );
}