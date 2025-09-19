import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get custom token from URL parameters
    const token = searchParams.get('token');
    
    console.log('=== PASSWORD RESET PAGE DEBUG ===');
    console.log('Page loaded at:', new Date().toISOString());
    console.log('Current URL:', window.location.href);
    console.log('Search params:', window.location.search);
    console.log('Token from URL:', token);
    console.log('User agent:', navigator.userAgent.substring(0, 100));
    console.log('Referrer:', document.referrer || 'none');
    
    if (!token) {
      console.error('No token found in URL parameters');
      setError('Invalid or expired reset link. Please request a new password reset.');
      setValidatingToken(false);
      return;
    }

    // Validate the custom token
    const validateToken = async () => {
      try {
        console.log('Validating token:', token);
        
        const { data, error } = await supabase
          .from('password_reset_tokens')
          .select('user_id, expires_at, used_at')
          .eq('token', token)
          .single();
        
        console.log('Token validation response:', { data, error });
        
        if (error || !data) {
          console.error('Token validation failed:', error);
          setError('Invalid or expired reset link. Please request a new password reset.');
          setValidatingToken(false);
          return;
        }

        // Check if token is expired
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        console.log('Token expires at:', expiresAt, 'Current time:', now);
        
        if (expiresAt < now) {
          console.error('Token has expired');
          setError('This reset link has expired. Please request a new password reset.');
          setValidatingToken(false);
          return;
        }

        // Check if token has already been used
        if (data.used_at) {
          console.error('Token has already been used:', data.used_at);
          setError('This reset link has already been used. Please request a new password reset.');
          setValidatingToken(false);
          return;
        }

        console.log('Token is valid for user:', data.user_id);
        setUserId(data.user_id);
      } catch (err) {
        console.error('Error validating token:', err);
        setError('Invalid or expired reset link. Please request a new password reset.');
      } finally {
        setValidatingToken(false);
      }
    };

    validateToken();
  }, [searchParams]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!userId) {
      setError('Invalid reset token. Please request a new password reset.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = searchParams.get('token');
      
      // Update the user's password using admin function
      const { error: updateError } = await supabase.rpc('admin_update_user_password', {
        user_id: userId,
        new_password: password,
        reset_token: token
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      toast({
        title: 'Password updated successfully',
        description: 'You can now log in with your new password.',
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 3000);

    } catch (error: any) {
      console.error('Password reset error:', error);
      setError('Failed to update password. Please try again or request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Validating reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-semibold text-foreground">Password Updated!</h2>
              <p className="text-muted-foreground">
                Your password has been successfully updated. You will be redirected to the login page shortly.
              </p>
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                disabled={loading}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Updating Password...' : 'Update Password'}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Link
              to="/auth"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}