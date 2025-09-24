import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLabelConfig } from '@/hooks/useLabelConfig';
import { Printer, Settings, TestTube } from 'lucide-react';

export default function PrintingSettingsPage() {
  const { config, activeProfile, generateCalibration, calibrationLoading } = useLabelConfig();

  return (
    <SettingsLayout
      title="Printing Settings"
      description="Configure label printing profiles and settings"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Label Printing Status
            </CardTitle>
            <CardDescription>
              Current label printing configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Active Profile</h4>
                <p className="text-muted-foreground">
                  {activeProfile?.label_name || 'None configured'} 
                  {activeProfile && ` (${activeProfile.width_mm}×${activeProfile.height_mm}mm)`}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium">Available Profiles</h4>
                <p className="text-muted-foreground">
                  {config?.profiles?.length || 0} profiles configured
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => activeProfile && generateCalibration(activeProfile.id)}
                  disabled={!activeProfile || calibrationLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <TestTube className="h-4 w-4" />
                  {calibrationLoading ? 'Generating...' : 'Test Calibration'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Advanced printing settings configuration coming soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Full admin interface for managing label profiles, printer settings, and station overrides will be available in the next update.
            </p>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}