import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Users, 
  ClipboardCheck,
  AlertCircle,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  action?: {
    label: string;
    onClick: () => void;
  };
}

function StatCard({ 
  title, 
  value, 
  description, 
  trend, 
  icon: Icon, 
  variant = 'default',
  action 
}: StatCardProps) {
  const variantStyles = {
    default: 'border-border',
    success: 'border-success/20 bg-success/5',
    warning: 'border-warning/20 bg-warning/5', 
    destructive: 'border-destructive/20 bg-destructive/5'
  };

  return (
    <Card className={cn("relative overflow-hidden", variantStyles[variant])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn(
          "h-4 w-4",
          variant === 'success' && "text-success",
          variant === 'warning' && "text-warning", 
          variant === 'destructive' && "text-destructive",
          variant === 'default' && "text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center text-xs text-muted-foreground">
            {trend && (
              <>
                {trend.isPositive ? (
                  <TrendingUp className="mr-1 h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3 text-destructive" />
                )}
                <span className={trend.isPositive ? "text-success" : "text-destructive"}>
                  {Math.abs(trend.value)}%
                </span>
                <span className="ml-1">from last month</span>
              </>
            )}
            {description && !trend && <span>{description}</span>}
          </div>
          {action && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={action.onClick}
              className="h-6 px-2 text-xs"
            >
              {action.label}
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardStats() {
  // This would come from your data source
  const stats = [
    {
      title: "Total Products",
      value: "2,847",
      trend: { value: 12.5, isPositive: true },
      icon: Package,
      variant: 'success' as const,
      action: { 
        label: "View All", 
        onClick: () => console.log("View products") 
      }
    },
    {
      title: "Active Staff",
      value: "23",
      trend: { value: 2.1, isPositive: true },
      icon: Users,
      variant: 'default' as const
    },
    {
      title: "Pending Reviews", 
      value: "47",
      description: "Requires attention",
      icon: ClipboardCheck,
      variant: 'warning' as const,
      action: {
        label: "Review",
        onClick: () => console.log("View pending")
      }
    },
    {
      title: "Issues",
      value: "3",
      trend: { value: 15.2, isPositive: false },
      icon: AlertCircle,
      variant: 'destructive' as const,
      action: {
        label: "Resolve", 
        onClick: () => console.log("View issues")
      }
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}