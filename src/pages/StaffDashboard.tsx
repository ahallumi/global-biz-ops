import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Plus, Clock, CheckCircle, User } from 'lucide-react';
import { StaffModeBanner } from '@/components/StaffModeBanner';
import { useNavigate } from 'react-router-dom';

export default function StaffDashboard() {
  const { employee } = useAuth();
  const navigate = useNavigate();

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded mb-4"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const firstName = employee.full_name.split(' ')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Simple Header */}
      <header className="bg-background/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Staff Portal</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{employee.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{employee.role}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Staff Mode Banner */}
      <StaffModeBanner />

      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Welcome back, {firstName}!</h2>
            <p className="text-muted-foreground">Manage your product intake submissions</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">My Submissions</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">Total intakes submitted</p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">9</div>
                <p className="text-xs text-muted-foreground">Successfully processed</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Common tasks for product intake management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button className="flex-1" onClick={() => navigate('/intakes/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Product Intake
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => navigate('/intakes')}>
                  <Package className="h-4 w-4 mr-2" />
                  View My Submissions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>My Recent Submissions</CardTitle>
              <CardDescription>
                Your latest product intake submissions and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: 'INT-2024-005', product: 'Wireless Bluetooth Headphones', status: 'Approved', date: '2 days ago' },
                  { id: 'INT-2024-006', product: 'Smartphone Case - Clear', status: 'Pending', date: '1 day ago' },
                  { id: 'INT-2024-007', product: 'USB-C Charging Cable', status: 'Under Review', date: '6 hours ago' },
                ].map((submission) => (
                  <div key={submission.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{submission.product}</p>
                      <p className="text-xs text-muted-foreground">{submission.id} • {submission.date}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      submission.status === 'Approved' ? 'bg-success/10 text-success' :
                      submission.status === 'Pending' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {submission.status}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}