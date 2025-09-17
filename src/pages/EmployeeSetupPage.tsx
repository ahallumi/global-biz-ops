import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function EmployeeSetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [employee, setEmployee] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid setup link - no token provided');
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('setup_token', token)
        .gt('setup_token_expires', new Date().toISOString())
        .single();

      if (error || !data) {
        setError('Invalid or expired setup link');
        setTokenValid(false);
      } else {
        setEmployee(data);
        setTokenValid(true);
        
        // Check if already completed
        if (data.account_setup_completed) {
          setError('This account has already been set up');
          setTokenValid(false);
        }
      }
    } catch (err: any) {
      console.error('Token validation error:', err);
      setError('Failed to validate setup link');
      setTokenValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSetupLoading(true);
    setError('');

    try {
      // Create auth user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: employee.email,
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: employee.first_name + ' ' + employee.last_name
          }
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Update employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          user_id: authData.user.id,
          account_setup_completed: true,
          online_access_enabled: true,
          setup_token: null,
          setup_token_expires: null
        })
        .eq('id', employee.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Account setup complete!",
        description: "You can now sign in with your email and password.",
      });

      // Redirect to login page
      navigate('/auth?message=Account setup complete. Please sign in.');

    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.message || 'Failed to complete account setup');
    } finally {
      setSetupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-center">
          <div className="h-8 w-32 bg-muted rounded mb-4 mx-auto"></div>
          <div className="h-4 w-48 bg-muted rounded mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Validating setup link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Account Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tokenValid ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Welcome {employee?.first_name || employee?.full_name}! 
                  Please create your password to complete your account setup.
                </AlertDescription>
              </Alert>

              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={employee?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Create Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={setupLoading}
                >
                  {setupLoading ? 'Setting up account...' : 'Complete Setup'}
                </Button>
              </form>

              <div className="text-center text-sm text-muted-foreground">
                <p>Role: {employee?.role?.toUpperCase()}</p>
                <p>Position: {employee?.position || 'Not specified'}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}