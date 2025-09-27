import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Printer, Ruler, Download, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CalibrationWizardProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stationId?: string;
  profileId: string;
}

interface CalibrationMeasurements {
  horizontal_mm: number;
  vertical_mm: number;
  corner_offset_x: number;
  corner_offset_y: number;
}

interface CalibrationResults {
  scale_x: number;
  scale_y: number;
  offset_x_mm: number;
  offset_y_mm: number;
}

export function CalibrationWizard({ isOpen, onOpenChange, stationId, profileId }: CalibrationWizardProps) {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [measurements, setMeasurements] = useState<CalibrationMeasurements>({
    horizontal_mm: 50.0,
    vertical_mm: 20.0,
    corner_offset_x: 0.0,
    corner_offset_y: 0.0
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handlePrintCalibrationCard = async () => {
    setIsGenerating(true);
    try {
      // Generate calibration grid label
      const response = await supabase.functions.invoke('generate-label', {
        body: {
          template_id: 'calibration-grid',
          profile_id: profileId,
          product: {
            name: 'Calibration Grid',
            barcode: '000000000000'
          }
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Create download link for calibration PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${response.data.pdf_base64}`;
      link.download = 'calibration-grid.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Calibration card generated",
        description: "Print the calibration card and measure it with a ruler.",
      });

      setStep(2);
    } catch (error) {
      console.error('Error generating calibration card:', error);
      toast({
        title: "Error",
        description: "Failed to generate calibration card.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const calculateCalibrationFactors = (): CalibrationResults => {
    // Expected dimensions for calibration grid
    const expectedHorizontal = 50.0; // mm
    const expectedVertical = 20.0;   // mm

    return {
      scale_x: Math.min(1.02, Math.max(0.98, measurements.horizontal_mm / expectedHorizontal)),
      scale_y: Math.min(1.02, Math.max(0.98, measurements.vertical_mm / expectedVertical)),
      offset_x_mm: Math.min(2.0, Math.max(-2.0, measurements.corner_offset_x)),
      offset_y_mm: Math.min(2.0, Math.max(-2.0, measurements.corner_offset_y))
    };
  };

  const handleSaveCalibration = async () => {
    if (!stationId) {
      toast({
        title: "Error",
        description: "Station ID is required for calibration.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const calibration = calculateCalibrationFactors();

      const { error } = await supabase
        .from('label_print_overrides')
        .upsert({
          station_id: stationId,
          profile_id: profileId,
          scale_x: calibration.scale_x,
          scale_y: calibration.scale_y,
          offset_x_mm: calibration.offset_x_mm,
          offset_y_mm: calibration.offset_y_mm
        }, {
          onConflict: 'station_id,profile_id'
        });

      if (error) throw error;

      toast({
        title: "Calibration saved",
        description: `Station calibrated with ${((calibration.scale_x - 1) * 100).toFixed(2)}% X scaling and ${((calibration.scale_y - 1) * 100).toFixed(2)}% Y scaling.`
      });

      onOpenChange(false);
      setStep(1);
    } catch (error) {
      console.error('Error saving calibration:', error);
      toast({
        title: "Error", 
        description: "Failed to save calibration settings.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const calibrationResults = calculateCalibrationFactors();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5" />
            Label Calibration Wizard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Progress value={(step / 3) * 100} className="w-full" />
          
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Step 1: Print Calibration Card</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  First, we'll print a calibration card with precise measurements. 
                  This will help us detect any mechanical drift in your printer.
                </p>
                
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    Calibration Grid Features:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 50.0mm horizontal ruler</li>
                    <li>• 20.0mm vertical ruler</li>
                    <li>• Corner alignment targets</li>
                    <li>• 5mm precision grid</li>
                  </ul>
                </div>

                <Button 
                  onClick={handlePrintCalibrationCard}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>Generating...</>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Generate & Print Calibration Card
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Step 2: Measure Printed Card</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Using a precise ruler, measure the actual dimensions of the printed calibration card.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="horizontal">Horizontal Ruler (mm)</Label>
                    <Input
                      id="horizontal"
                      type="number"
                      step="0.1"
                      value={measurements.horizontal_mm}
                      onChange={(e) => setMeasurements(prev => ({
                        ...prev,
                        horizontal_mm: parseFloat(e.target.value) || 50.0
                      }))}
                      placeholder="50.0"
                    />
                    <p className="text-xs text-muted-foreground">Expected: 50.0mm</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vertical">Vertical Ruler (mm)</Label>
                    <Input
                      id="vertical"
                      type="number"
                      step="0.1"
                      value={measurements.vertical_mm}
                      onChange={(e) => setMeasurements(prev => ({
                        ...prev,
                        vertical_mm: parseFloat(e.target.value) || 20.0
                      }))}
                      placeholder="20.0"
                    />
                    <p className="text-xs text-muted-foreground">Expected: 20.0mm</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offset-x">Corner Offset X (mm)</Label>
                    <Input
                      id="offset-x"
                      type="number"
                      step="0.1"
                      value={measurements.corner_offset_x}
                      onChange={(e) => setMeasurements(prev => ({
                        ...prev,
                        corner_offset_x: parseFloat(e.target.value) || 0.0
                      }))}
                      placeholder="0.0"
                    />
                    <p className="text-xs text-muted-foreground">Left/right shift</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="offset-y">Corner Offset Y (mm)</Label>
                    <Input
                      id="offset-y"
                      type="number"
                      step="0.1"
                      value={measurements.corner_offset_y}
                      onChange={(e) => setMeasurements(prev => ({
                        ...prev,
                        corner_offset_y: parseFloat(e.target.value) || 0.0
                      }))}
                      placeholder="0.0"
                    />
                    <p className="text-xs text-muted-foreground">Up/down shift</p>
                  </div>
                </div>

                <Button onClick={() => setStep(3)} className="w-full">
                  Calculate Calibration
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Step 3: Review & Apply</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Calculated Adjustments:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">X Scale:</span>
                      <span className="ml-2 font-mono">
                        {((calibrationResults.scale_x - 1) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Y Scale:</span>
                      <span className="ml-2 font-mono">
                        {((calibrationResults.scale_y - 1) * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">X Offset:</span>
                      <span className="ml-2 font-mono">
                        {calibrationResults.offset_x_mm.toFixed(2)}mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Y Offset:</span>
                      <span className="ml-2 font-mono">
                        {calibrationResults.offset_y_mm.toFixed(2)}mm
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    Back to Measurements
                  </Button>
                  <Button 
                    onClick={handleSaveCalibration}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <>Saving...</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Apply Calibration
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}