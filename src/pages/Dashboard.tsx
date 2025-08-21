import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Package, 
  ClipboardCheck, 
  Users, 
  Warehouse,
  Plus,
  TrendingUp,
  CheckCircle,
  Clock
} from 'lucide-react';

export default function Dashboard() {
  const { employee } = useAuth();

  if (!employee) return null;

  const isAdmin = employee.role === 'admin';

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to your business operations center
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Intakes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                +2 from yesterday
              </p>
            </CardContent>
          </Card>

          {isAdmin && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting approval
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">
                    Across all suppliers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">
                    Active employees
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
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
              <Link to="/product-intake">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Package className="w-4 h-4" />
                  New Product Intake
                </Button>
              </Link>
              
              {isAdmin && (
                <>
                  <Link to="/review">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <ClipboardCheck className="w-4 h-4" />
                      Review Pending Intakes
                    </Button>
                  </Link>
                  
                  <Link to="/employees">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Users className="w-4 h-4" />
                      Manage Employees
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest updates and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-success rounded-full mt-2"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Intake #INK-2024-001 approved</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">New employee Sarah added</p>
                  <p className="text-xs text-muted-foreground">1 day ago</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-warning rounded-full mt-2"></div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">Supplier CED updated products</p>
                  <p className="text-xs text-muted-foreground">2 days ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
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