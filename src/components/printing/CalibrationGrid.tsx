import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Ruler, Target, Download } from 'lucide-react';
import { toast } from 'sonner';

interface CalibrationGridProps {
  printerId: string;
  printerName: string;
  profileId: string;
  profileName: string;
  dimensions: {
    width_mm: number;
    height_mm: number;
    dpi: number;
  };
  onCalibrationSaved: (calibration: CalibrationData) => void;
}

export interface CalibrationData {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export function CalibrationGrid({
  printerId,
  printerName,
  profileId,
  profileName,
  dimensions,
  onCalibrationSaved
}: CalibrationGridProps) {
  const [measuredWidth, setMeasuredWidth] = React.useState<string>('');
  const [measuredHeight, setMeasuredHeight] = React.useState<string>('');
  const [measuredOffsetX, setMeasuredOffsetX] = React.useState<string>('');
  const [measuredOffsetY, setMeasuredOffsetY] = React.useState<string>('');
  const [isGenerating, setIsGenerating] = React.useState(false);

  const generateCalibrationLabel = async () => {
    setIsGenerating(true);
    try {
      // Generate calibration grid PDF
      const response = await fetch('/api/generate-calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width_mm: dimensions.width_mm,
          height_mm: dimensions.height_mm,
          dpi: dimensions.dpi
        })
      });

      if (!response.ok) throw new Error('Failed to generate calibration grid');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Download the calibration grid
      const a = document.createElement('a');
      a.href = url;
      a.download = `calibration-${profileName}-${dimensions.width_mm}x${dimensions.height_mm}mm.pdf`;
      a.click();
      
      URL.revokeObjectURL(url);
      toast.success('Calibration grid downloaded. Print it and measure the results.');
      
    } catch (error) {
      toast.error('Failed to generate calibration grid');
      console.error('Calibration generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCalibration = () => {
    const widthMm = parseFloat(measuredWidth);
    const heightMm = parseFloat(measuredHeight);
    const offsetXMm = parseFloat(measuredOffsetX);
    const offsetYMm = parseFloat(measuredOffsetY);

    if (isNaN(widthMm) || isNaN(heightMm) || isNaN(offsetXMm) || isNaN(offsetYMm)) {
      toast.error('Please enter valid measurements for all fields');
      return;
    }

    // Calculate calibration values
    const targetWidth = dimensions.width_mm - 2; // 1mm margin on each side
    const targetHeight = dimensions.height_mm - 2;
    
    const scaleX = widthMm / targetWidth;
    const scaleY = heightMm / targetHeight;
    const offsetX = offsetXMm - 1; // We intended 1mm offset
    const offsetY = offsetYMm - 1;

    const calibration: CalibrationData = {
      scaleX,
      scaleY,
      offsetX,
      offsetY
    };

    console.log('Calculated calibration:', {
      target: { width: targetWidth, height: targetHeight },
      measured: { width: widthMm, height: heightMm },
      offsets: { x: offsetXMm, y: offsetYMm },
      calibration
    });

    onCalibrationSaved(calibration);
    toast.success('Calibration saved successfully!');
  };

  const isFormValid = measuredWidth && measuredHeight && measuredOffsetX && measuredOffsetY;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Printer Calibration
        </CardTitle>
        <CardDescription>
          Calibrate {printerName} for precise {profileName} ({dimensions.width_mm}×{dimensions.height_mm}mm) printing
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Step 1: Generate Calibration Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step 1</Badge>
            <span className="font-medium">Generate & Print Calibration Grid</span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Generate a test page with measurement grid and print it using your configured printer.
          </p>
          
          <Button 
            onClick={generateCalibrationLabel}
            disabled={isGenerating}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Download Calibration Grid'}
          </Button>
        </div>

        {/* Step 2: Measure Results */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step 2</Badge>
            <span className="font-medium">Measure Printed Results</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Use a ruler to measure the printed calibration grid. Enter measurements in millimeters.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="measured-width">Box Width (mm)</Label>
              <Input
                id="measured-width"
                type="number"
                step="0.1"
                placeholder={`Target: ${dimensions.width_mm - 2}mm`}
                value={measuredWidth}
                onChange={(e) => setMeasuredWidth(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="measured-height">Box Height (mm)</Label>
              <Input
                id="measured-height"
                type="number"
                step="0.1"
                placeholder={`Target: ${dimensions.height_mm - 2}mm`}
                value={measuredHeight}
                onChange={(e) => setMeasuredHeight(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="measured-offset-x">Left Edge Gap (mm)</Label>
              <Input
                id="measured-offset-x"
                type="number"
                step="0.1"
                placeholder="Target: 1.0mm"
                value={measuredOffsetX}
                onChange={(e) => setMeasuredOffsetX(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="measured-offset-y">Top Edge Gap (mm)</Label>
              <Input
                id="measured-offset-y"
                type="number"
                step="0.1"
                placeholder="Target: 1.0mm"
                value={measuredOffsetY}
                onChange={(e) => setMeasuredOffsetY(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Step 3: Save Calibration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Step 3</Badge>
            <span className="font-medium">Save Calibration</span>
          </div>

          <Button 
            onClick={saveCalibration}
            disabled={!isFormValid}
            className="w-full"
          >
            <Ruler className="w-4 h-4 mr-2" />
            Save Calibration
          </Button>

          {isFormValid && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Calibration Preview:</p>
              <div className="space-y-1 text-muted-foreground">
                <p>Scale: {((parseFloat(measuredWidth) || 0) / (dimensions.width_mm - 2)).toFixed(4)}x, {((parseFloat(measuredHeight) || 0) / (dimensions.height_mm - 2)).toFixed(4)}y</p>
                <p>Offset: {((parseFloat(measuredOffsetX) || 0) - 1).toFixed(2)}mm, {((parseFloat(measuredOffsetY) || 0) - 1).toFixed(2)}mm</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}