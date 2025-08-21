import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { EnhancedDashboardStats } from '@/components/enhanced-dashboard/EnhancedDashboardStats';
import { ActivityFeed } from '@/components/enhanced-dashboard/ActivityFeed';
import { 
  Package, 
  ClipboardCheck, 
  Users, 
  Plus,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';

export default function Dashboard() {
  const { employee } = useAuth();

  if (!employee) return null;

  const isAdmin = employee.role === 'admin';

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {employee.full_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {employee.role}
            </Badge>
            <Link to="/product-intake">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Intake
              </Button>
            </Link>
          </div>
        </div>

        {/* Enhanced Stats */}
        <EnhancedDashboardStats isAdmin={isAdmin} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common tasks to get you started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/product-intake" className="block">
                <Button variant="outline" className="w-full justify-start gap-2 hover:bg-primary/5">
                  <Package className="w-4 h-4" />
                  New Product Intake
                </Button>
              </Link>
              
              {isAdmin && (
                <>
                  <Link to="/review" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2 hover:bg-primary/5">
                      <ClipboardCheck className="w-4 h-4" />
                      Review Pending Intakes
                    </Button>
                  </Link>
                  
                  <Link to="/suppliers" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2 hover:bg-primary/5">
                      <Package className="w-4 h-4" />
                      Manage Suppliers
                    </Button>
                  </Link>
                  
                  <Link to="/employees" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2 hover:bg-primary/5">
                      <Users className="w-4 h-4" />
                      Manage Employees
                    </Button>
                  </Link>

                  <Link to="/analytics" className="block">
                    <Button variant="outline" className="w-full justify-start gap-2 hover:bg-primary/5">
                      <BarChart3 className="w-4 h-4" />
                      View Analytics
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <ActivityFeed />
        </div>

        {/* Role-specific content */}
        {!isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>My Recent Submissions</CardTitle>
              <CardDescription>
                Track your product intake submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium">Intake #INK-2024-001</p>
                      <p className="text-sm text-muted-foreground">Submitted 2 days ago</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-success border-success">
                    Approved
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-warning" />
                    <div>
                      <p className="font-medium">Intake #INK-2024-002</p>
                      <p className="text-sm text-muted-foreground">Submitted 1 day ago</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-warning border-warning">
                    Pending
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}