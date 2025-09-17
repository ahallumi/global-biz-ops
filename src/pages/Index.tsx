import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { 
  Package, 
  Users, 
  TrendingUp, 
  Shield,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Building2,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, employee, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Index component auth state:', { user: !!user, employee: !!employee, loading });
    
    if (!loading && user && employee) {
      // Redirect based on role
      if (employee.role === 'staff') {
        navigate('/staff-dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, employee, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-48 mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-64 mx-auto" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Handle user with restricted access (online_access_enabled: false)
  if (user && (!employee || (employee as any).hasRestrictedAccess)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Access Restricted</CardTitle>
            <CardDescription>
              Your account does not have online access enabled. Please contact your administrator to enable online access.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={signOut}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle authenticated user with employee data (will redirect)
  if (user && employee) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Global Staff Hub
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/staff-login">
              <Button className="gap-2">
                <Users className="w-4 h-4" />
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="space-y-4">
            <Badge variant="outline" className="px-4 py-2 gap-2 bg-background/50 backdrop-blur border-primary/20">
              <Sparkles className="w-3 h-3 text-primary" />
              Enterprise-Grade Security
            </Badge>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Streamline Your 
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                {" "}Business Operations
              </span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Manage product intake, inventory, and employee operations with our comprehensive business management platform designed for modern enterprises.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/staff-login">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                <Users className="w-4 h-4" />
                Staff Login
              </Button>
            </Link>
            <Link to="/admin-login">
              <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                <Shield className="w-4 h-4" />
                Admin Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Product Intake</CardTitle>
              <CardDescription>
                Streamlined workflow for managing product submissions and approvals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Barcode scanning</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Photo documentation</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Invoice management</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-success" />
              </div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Role-based access control and employee management tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Role-based permissions</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Activity tracking</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>HR integration ready</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Business Intelligence</CardTitle>
              <CardDescription>
                Real-time analytics and reporting for informed decision making
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Real-time dashboards</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Inventory tracking</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Performance metrics</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to Get Started?</CardTitle>
              <CardDescription className="text-lg">
                Join hundreds of businesses streamlining their operations with Global Staff Hub
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 justify-center">
                <Link to="/staff-login">
                  <Button size="lg" className="gap-2">
                    <Users className="w-4 h-4" />
                    Staff Access
                  </Button>
                </Link>
                <Link to="/admin-login">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Shield className="w-4 h-4" />
                    Admin Access
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
