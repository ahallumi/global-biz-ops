import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, ExternalLink, Settings, Printer, Gauge } from "lucide-react";

interface BrotherSetupGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredDimensions: {
    width_mm: number;
    height_mm: number;
  };
  detectedRoll?: string;
  setupRequired?: boolean;
}

export function BrotherSetupGuide({ 
  open, 
  onOpenChange, 
  requiredDimensions,
  detectedRoll,
  setupRequired = false
}: BrotherSetupGuideProps) {
  const steps = [
    {
      id: 'check-media',
      title: 'Run Check Media',
      icon: <Gauge className="h-5 w-5" />,
      description: 'Detect the installed DK roll using Brother P-touch Editor',
      instructions: [
        'Open Brother P-touch Editor software',
        'Go to Printer/Page Setup',
        'Click "Check Media" button',
        `Verify it detects the correct roll for ${requiredDimensions.width_mm}×${requiredDimensions.height_mm}mm labels`,
        'If detection fails, clean the 5 sensors and reseat the roll'
      ],
      status: detectedRoll ? 'complete' : 'required'
    },
    {
      id: 'printer-preferences',
      title: 'Set Printing Preferences',
      icon: <Settings className="h-5 w-5" />,
      description: 'Configure Windows printer driver for correct paper size',
      instructions: [
        'Open Devices & Printers in Windows',
        'Right-click your Brother QL printer',
        'Select "Printing preferences"',
        `Set paper size to ${requiredDimensions.width_mm}×${requiredDimensions.height_mm}mm`,
        'Apply and save settings'
      ],
      status: setupRequired ? 'required' : 'recommended'
    },
    {
      id: 'printnode-engine',
      title: 'PrintNode Engine6',
      icon: <Printer className="h-5 w-5" />,
      description: 'Enable Engine6 backend for reliable option handling',
      instructions: [
        'Open PrintNode Client application',
        'Go to Settings/Preferences',
        'Set "Default printing backend" to Engine6',
        'Restart PrintNode Client if needed'
      ],
      status: 'recommended'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'required':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="default" className="text-xs">Complete</Badge>;
      case 'required':
        return <Badge variant="destructive" className="text-xs">Required</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Recommended</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Brother QL Setup Guide
          </DialogTitle>
          <DialogDescription>
            Follow these steps to ensure reliable printing with Brother QL-800 printers.
            {detectedRoll && (
              <div className="mt-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Detected roll: <strong>{detectedRoll}</strong></span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Required Dimensions */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Required Label Size</p>
                  <p className="text-sm text-muted-foreground">
                    {requiredDimensions.width_mm}×{requiredDimensions.height_mm}mm
                  </p>
                </div>
                <Badge variant="outline" className="font-mono">
                  {requiredDimensions.width_mm}×{requiredDimensions.height_mm}mm
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Setup Steps */}
          {steps.map((step, index) => (
            <Card key={step.id} className="relative">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(step.status)}
                      {step.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{step.title}</h3>
                        {getStatusBadge(step.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {step.description}
                      </p>
                      <ol className="text-sm space-y-1 ml-4">
                        {step.instructions.map((instruction, i) => (
                          <li key={i} className="list-decimal">
                            {instruction}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Help Links */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Additional Resources
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Brother Support:</strong>{' '}
                  <a 
                    href="https://support.brother.ca/app/answers/detail/a_id/134639" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Label/Tape Mismatch Troubleshooting
                  </a>
                </div>
                <div>
                  <strong>PrintNode Docs:</strong>{' '}
                  <a 
                    href="https://www.printnode.com/en/docs/api/curl" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    API Reference & Print Options
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Got It
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}