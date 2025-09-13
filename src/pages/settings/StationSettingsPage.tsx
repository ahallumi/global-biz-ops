import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { StationAccessManagement } from '@/components/admin/StationAccessManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Monitor, Clock, Settings as SettingsIcon, ExternalLink, LogIn, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export default function StationSettingsPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState({
    activeStations: 0,
    accessCodes: 0,
    sessionTimeout: '8h',
    loading: true
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch active access codes count
        const { count: codesCount } = await supabase
          .from('station_login_codes')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        // Fetch session timeout from time_settings
        const { data: timeSettings } = await supabase
          .from('time_settings')
          .select('auto_clock_out_hours')
          .single();

        setMetrics({
          activeStations: 0, // TODO: Implement active sessions tracking
          accessCodes: codesCount || 0,
          sessionTimeout: `${timeSettings?.auto_clock_out_hours || 8}h`,
          loading: false
        });
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
        setMetrics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchMetrics();
  }, []);

  const copyLoginLink = async () => {
    const loginUrl = `${window.location.origin}/station-login`;
    try {
      await navigator.clipboard.writeText(loginUrl);
      toast({
        title: "Link copied!",
        description: "Station login link has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <SettingsLayout 
      title="Station Settings"
      description="Manage station access codes, configurations, and security settings"
    >
      <div className="space-y-8">
        {/* Station Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Active Stations</p>
                  <p className="text-2xl font-bold">
                    {metrics.loading ? "..." : metrics.activeStations}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium">Access Codes</p>
                  <p className="text-2xl font-bold">
                    {metrics.loading ? "..." : metrics.accessCodes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium">Session Timeout</p>
                  <p className="text-2xl font-bold">
                    {metrics.loading ? "..." : metrics.sessionTimeout}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Station Access Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Code Management
            </CardTitle>
            <CardDescription>
              Generate, manage, and monitor station access codes for secure terminal access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StationAccessManagement />
          </CardContent>
        </Card>

        {/* Station Login Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Station Login Instructions
            </CardTitle>
            <CardDescription>
              Guide staff on accessing station terminals using the access codes you generate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Station Login Page</h4>
                <div className="flex items-center gap-2">
                  <Button onClick={copyLoginLink} variant="outline" size="sm">
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/station-login" className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Open Login Page
                    </Link>
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Direct staff to use this page for secure station access with their assigned codes.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">How Staff Should Login</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium mt-0.5">1</span>
                    Visit the station login page using the link above
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium mt-0.5">2</span>
                    Enter their 12-character access code
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium mt-0.5">3</span>
                    Access will be granted based on their assigned role
                  </li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Access Code Format</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-mono text-center">ABCD-1234-WXYZ</p>
                    <p className="text-xs text-muted-foreground text-center mt-1">12-character format</p>
                  </div>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Codes are automatically generated</li>
                    <li>• Each code has an expiration date</li>
                    <li>• Role-based access permissions apply</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Future Settings Sections */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Station Configuration
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground ml-auto">
                Coming Soon
              </span>
            </CardTitle>
            <CardDescription>
              Configure default settings, session timeouts, and feature restrictions for station terminals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Session Settings</h4>
                <ul className="text-sm space-y-1">
                  <li>• Default session timeout</li>
                  <li>• Auto-logout on inactivity</li>
                  <li>• Multi-session handling</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Feature Access</h4>
                <ul className="text-sm space-y-1">
                  <li>• Allowed pages per role</li>
                  <li>• Function restrictions</li>
                  <li>• Data access controls</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Station Monitoring
              <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground ml-auto">
                Coming Soon
              </span>
            </CardTitle>
            <CardDescription>
              Monitor active sessions, audit logs, and security events across all station terminals
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p className="text-sm">
              View real-time station activity, session history, and security audit trails.
            </p>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}