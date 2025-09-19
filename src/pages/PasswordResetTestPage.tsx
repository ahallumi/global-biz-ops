import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PasswordResetTestPage() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<any>({});
  
  useEffect(() => {
    const token = searchParams.get('token');
    const results = {
      timestamp: new Date().toISOString(),
      currentUrl: window.location.href,
      token: token,
      tokenLength: token?.length || 0,
      userAgent: navigator.userAgent,
      referrer: document.referrer || 'none',
      protocol: window.location.protocol,
      host: window.location.host,
      pathname: window.location.pathname,
      search: window.location.search,
      cookiesEnabled: navigator.cookieEnabled,
      language: navigator.language,
      onlineStatus: navigator.onLine,
    };
    
    setTestResults(results);
    console.log('=== PASSWORD RESET TEST PAGE ===', results);
  }, [searchParams]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Copied!',
        description: 'Information copied to clipboard',
      });
    });
  };

  const copyDebugInfo = () => {
    const debugText = `Password Reset Debug Info:
Timestamp: ${testResults.timestamp}
URL: ${testResults.currentUrl}
Token: ${testResults.token || 'MISSING'}
Token Length: ${testResults.tokenLength}
User Agent: ${testResults.userAgent}
Referrer: ${testResults.referrer}
Protocol: ${testResults.protocol}
Host: ${testResults.host}
Cookies Enabled: ${testResults.cookiesEnabled}
Language: ${testResults.language}
Online: ${testResults.onlineStatus}`;
    
    copyToClipboard(debugText);
  };

  const token = searchParams.get('token');
  const hasToken = !!token;
  const isValidTokenFormat = token && token.length > 20;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              🔧 Password Reset Debug
            </CardTitle>
            <CardDescription>
              This page helps diagnose password reset link issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  {hasToken ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <p className="text-sm font-medium">Token Present</p>
                <Badge variant={hasToken ? "default" : "destructive"}>
                  {hasToken ? "Yes" : "No"}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  {isValidTokenFormat ? (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-yellow-500" />
                  )}
                </div>
                <p className="text-sm font-medium">Token Format</p>
                <Badge variant={isValidTokenFormat ? "default" : "secondary"}>
                  {isValidTokenFormat ? "Valid" : "Invalid"}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-sm font-medium">Page Access</p>
                <Badge variant="default">Working</Badge>
              </div>
            </div>

            {/* Token Information */}
            {token && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Token:</strong> {token.substring(0, 20)}...{token.substring(token.length - 8)}</p>
                    <p><strong>Length:</strong> {token.length} characters</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Debug Information */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Debug Information</h3>
              <div className="bg-muted p-4 rounded-lg text-sm font-mono space-y-1">
                <div><strong>Current URL:</strong> {testResults.currentUrl}</div>
                <div><strong>Referrer:</strong> {testResults.referrer}</div>
                <div><strong>Protocol:</strong> {testResults.protocol}</div>
                <div><strong>Host:</strong> {testResults.host}</div>
                <div><strong>Cookies:</strong> {testResults.cookiesEnabled ? 'Enabled' : 'Disabled'}</div>
                <div><strong>Language:</strong> {testResults.language}</div>
                <div><strong>Online:</strong> {testResults.onlineStatus ? 'Yes' : 'No'}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {hasToken && (
                <Button asChild className="flex-1">
                  <Link to={`/password-reset?token=${token}`}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Try Password Reset
                  </Link>
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={copyDebugInfo}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Debug Info
              </Button>
            </div>

            {/* Instructions */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>What to do:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>If you see a token above, the email link is working correctly</li>
                    <li>Click "Try Password Reset" to proceed with resetting your password</li>
                    <li>If there are issues, copy the debug info and share it with support</li>
                    <li>Try opening the link in an incognito/private browser window</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>

            <div className="text-center">
              <Button variant="ghost" asChild>
                <Link to="/auth">← Back to Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}