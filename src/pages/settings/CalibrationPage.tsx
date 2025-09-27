import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Target, Printer } from 'lucide-react';
import { CalibrationWizard } from '@/components/label-designer/CalibrationWizard';
import { useLabelConfig } from '@/hooks/useLabelConfig';

export function CalibrationPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const { config } = useLabelConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Printer Calibration
        </h1>
        <p className="text-muted-foreground mt-1">
          Fine-tune printer precision for pixel-perfect labels (±0.2mm accuracy)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Station Calibration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Why Calibrate?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Compensates for mechanical tolerances in printer hardware</li>
              <li>• Eliminates scale drift (typically ±0.5-2% on different units)</li>
              <li>• Corrects positional offset from print head alignment</li>
              <li>• Ensures consistent results across multiple label stations</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Available Label Profiles:</h4>
            {config?.profiles?.map((profile) => (
              <Card key={profile.id} className="border-l-4 border-l-primary">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="font-medium">{profile.label_name}</h5>
                      <p className="text-sm text-muted-foreground">
                        {profile.width_mm}mm × {profile.height_mm}mm @ {profile.dpi} DPI
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Paper: {profile.template_id || 'Unknown'}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedProfile(profile.id);
                        setIsWizardOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Calibrate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {(!config?.profiles || config.profiles.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Printer className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No label profiles configured</p>
              <p className="text-sm">Configure printers first in Printing Settings</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-green-600">✓ Do This</h5>
              <ul className="space-y-1 text-muted-foreground mt-2">
                <li>• Use a precision metal ruler</li>
                <li>• Calibrate each station separately</li>
                <li>• Re-calibrate after label roll changes</li>
                <li>• Test print after calibration</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-destructive">✗ Avoid This</h5>
              <ul className="space-y-1 text-muted-foreground mt-2">
                <li>• Using plastic or flexible rulers</li>
                <li>• Calibrating with old/curled labels</li>
                <li>• Extreme adjustments (&gt;2% scaling)</li>
                <li>• Measuring at label edges</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <CalibrationWizard
        isOpen={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        stationId={localStorage.getItem('station-id') || undefined}
        profileId={selectedProfile}
      />
    </div>
  );
}