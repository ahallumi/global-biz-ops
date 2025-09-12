import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { StationAccessManagement } from '@/components/admin/StationAccessManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Monitor, Clock, Settings as SettingsIcon } from 'lucide-react';

export default function StationSettingsPage() {
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
                  <p className="text-2xl font-bold">3</p>
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
                  <p className="text-2xl font-bold">12</p>
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
                  <p className="text-2xl font-bold">8h</p>
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