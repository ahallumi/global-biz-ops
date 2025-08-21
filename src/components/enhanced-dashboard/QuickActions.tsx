import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  ClipboardCheck,
  Users,
  Settings,
  PlusCircle,
  FileText,
  BarChart3,
  Search
} from 'lucide-react';

interface QuickAction {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  badge?: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  variant?: 'default' | 'outline' | 'secondary';
}

export function QuickActions() {
  const actions: QuickAction[] = [
    {
      title: "Add Product",
      description: "Register new inventory item",
      icon: PlusCircle,
      onClick: () => console.log("Add product"),
      variant: 'default'
    },
    {
      title: "Review Intakes",
      description: "Process pending submissions", 
      icon: ClipboardCheck,
      onClick: () => console.log("Review intakes"),
      badge: { label: "47 pending", variant: 'destructive' },
      variant: 'outline'
    },
    {
      title: "Generate Report",
      description: "Export analytics data",
      icon: FileText,
      onClick: () => console.log("Generate report"),
      variant: 'outline'
    },
    {
      title: "View Analytics",
      description: "Dashboard insights",
      icon: BarChart3, 
      onClick: () => console.log("View analytics"),
      variant: 'outline'
    },
    {
      title: "Search Inventory", 
      description: "Find products quickly",
      icon: Search,
      onClick: () => console.log("Search inventory"),
      variant: 'secondary'
    },
    {
      title: "Manage Staff",
      description: "Employee administration",
      icon: Users,
      onClick: () => console.log("Manage staff"),
      variant: 'outline'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {action.title}
                    </span>
                    {action.badge && (
                      <Badge variant={action.badge.variant} className="text-xs">
                        {action.badge.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant={action.variant}
                onClick={action.onClick}
                className="shrink-0"
              >
                Go
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}