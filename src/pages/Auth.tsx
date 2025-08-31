import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Users, Shield, ArrowLeft } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-2xl">
        {/* Back to Home Link */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Global Staff Hub</h1>
          <p className="text-muted-foreground">Choose your access level to continue</p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Staff Access Card */}
          <Card className="shadow-xl hover:shadow-2xl transition-shadow cursor-pointer group">
            <CardHeader className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-2xl mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-xl">Staff Access</CardTitle>
              <CardDescription className="text-center">
                Access staff dashboard, time tracking, and operational tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/staff-login')}
                className="w-full"
                variant="outline"
              >
                Continue as Staff
              </Button>
            </CardContent>
          </Card>

          {/* Admin Access Card */}
          <Card className="shadow-xl hover:shadow-2xl transition-shadow cursor-pointer group">
            <CardHeader className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-2xl mb-2 group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl">Admin Access</CardTitle>
              <CardDescription className="text-center">
                Full system access, user management, and administrative controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/admin-login')}
                className="w-full"
              >
                Continue as Admin
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}