import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalibrationWizard } from '@/components/label-designer/CalibrationWizard';
import { useLabelConfig } from '@/hooks/useLabelConfig';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ArrowLeft, Printer, Target, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CalibrationPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const { config, isLoading } = useLabelConfig();

  if (isLoading) {
    return (
      <SettingsLayout title="Label Calibration" description="Calibrate label printers for pixel-perfect accuracy">
        <div className="space-y-4">
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
      </SettingsLayout>
    );
  }

  const handleCalibrateProfile = (profileId: string) => {
    setSelectedProfile(profileId);
    setIsWizardOpen(true);
  };

  return (
    <SettingsLayout title="Label Calibration" description="Calibrate label printers for pixel-perfect accuracy">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link to="/settings/printing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Printing Settings
            </Button>
          </Link>
        </div>

        {/* Calibration Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Station Calibration
            </CardTitle>
            <CardDescription>
              Calibrate each printing station for maximum label accuracy. This ensures that labels print at exactly the intended size and position.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Benefits of Calibration</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Pixel-perfect label positioning</li>
                  <li>• Consistent print output across stations</li>
                  <li>• Eliminates manual print adjustments</li>
                  <li>• Improves barcode scanning reliability</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">When to Calibrate</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Setting up a new printing station</li>
                  <li>• After printer maintenance</li>
                  <li>• When labels appear misaligned</li>
                  <li>• Changing to different label stocks</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Profiles */}
        <Card>
          <CardHeader>
            <CardTitle>Available Label Profiles</CardTitle>
            <CardDescription>
              Select a label profile to begin calibration for the current station.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!config?.profiles || config.profiles.length === 0 ? (
              <div className="text-center py-8">
                <Printer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Label Profiles Configured</h3>
                <p className="text-muted-foreground mb-4">
                  You need to create label profiles before calibrating stations.
                </p>
                <Link to="/settings/printing">
                  <Button>Configure Label Profiles</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {config.profiles.map((profile) => (
                  <Card key={profile.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-8 border-2 border-muted rounded flex items-center justify-center text-xs font-mono">
                            {profile.width_mm}×{profile.height_mm}
                          </div>
                          <div>
                            <h3 className="font-medium">{profile.label_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {profile.width_mm}mm × {profile.height_mm}mm • {profile.dpi} DPI
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {profile.id === config.active_profile_id && (
                            <Badge variant="default">Active</Badge>
                          )}
                          <Button 
                            onClick={() => handleCalibrateProfile(profile.id)}
                            size="sm"
                          >
                            Calibrate
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle>Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Do This
                </h4>
                <ul className="text-sm space-y-1">
                  <li>• Use a ruler with millimeter markings</li>
                  <li>• Measure from the exact edge of print marks</li>
                  <li>• Calibrate in good lighting conditions</li>
                  <li>• Allow printer to warm up before calibrating</li>
                  <li>• Use the same label stock for calibration</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-amber-600 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Avoid This
                </h4>
                <ul className="text-sm space-y-1">
                  <li>• Don't guess measurements - be precise</li>
                  <li>• Don't calibrate with wrinkled labels</li>
                  <li>• Don't skip the warmup period</li>
                  <li>• Don't use damaged measuring tools</li>
                  <li>• Don't rush the measurement process</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calibration Wizard */}
        <CalibrationWizard
          isOpen={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          stationId={localStorage.getItem('station-id') || undefined}
          profileId={selectedProfile || undefined}
        />
      </div>
    </SettingsLayout>
  );
}