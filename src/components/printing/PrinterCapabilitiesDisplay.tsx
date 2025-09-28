import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Printer } from "lucide-react";
import { findPaperMatch, tenthsToMm, type PrinterCapabilities } from "@/lib/paperMatching";

interface PrinterCapabilitiesDisplayProps {
  printer: {
    id: string;
    name: string;
    capabilities?: PrinterCapabilities;
  } | null;
  profileWidth: number;
  profileHeight: number;
}

export function PrinterCapabilitiesDisplay({ 
  printer, 
  profileWidth, 
  profileHeight 
}: PrinterCapabilitiesDisplayProps) {
  if (!printer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Printer Status
          </CardTitle>
          <CardDescription>No printer selected</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const capabilities = printer.capabilities;
  const paperMatch = capabilities?.papers ? 
    findPaperMatch(capabilities.papers, profileWidth, profileHeight) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          {printer.name}
        </CardTitle>
        <CardDescription>Printer capabilities and compatibility</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Paper Size Compatibility */}
        <div>
          <h4 className="font-medium mb-2">Paper Size Compatibility</h4>
          <div className="flex items-center gap-2">
            {paperMatch ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="text-sm">
                  <span className="font-medium">Compatible: {paperMatch.name}</span>
                  {paperMatch.rotate !== 0 && (
                    <div className="text-xs text-muted-foreground">
                      Label will be rotated {paperMatch.rotate}° for proper orientation
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <div className="text-sm">
                  <span className="font-medium">Custom size: {profileWidth}×{profileHeight}mm</span>
                  <div className="text-xs text-muted-foreground">
                    Ensure printer supports custom paper sizes
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Available Paper Sizes */}
        {capabilities?.papers && (
          <div>
            <h4 className="font-medium mb-2">Available Paper Sizes</h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(capabilities.papers)
                .filter(([_, [w, h]]) => w !== null && h !== null)
                .slice(0, 6)
                .map(([name, [w, h]]) => (
                  <Badge 
                    key={name} 
                    variant="outline" 
                    className="text-xs"
                  >
                    {name} ({tenthsToMm(w!)}×{tenthsToMm(h!)}mm)
                  </Badge>
                ))}
              {Object.keys(capabilities.papers).length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{Object.keys(capabilities.papers).length - 6} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Capabilities Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Custom Paper:</span>
            <span className="ml-2">
              {capabilities?.supports_custom_paper_size ? 
                <Badge variant="default" className="text-xs">Supported</Badge> : 
                <Badge variant="secondary" className="text-xs">Not Supported</Badge>
              }
            </span>
          </div>
          <div>
            <span className="font-medium">Available DPIs:</span>
            <span className="ml-2">
              {capabilities?.dpis?.length ? (
                <Badge variant="outline" className="text-xs">
                  {capabilities.dpis.slice(0, 2).join(', ')}
                  {capabilities.dpis.length > 2 && '...'}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Unknown</Badge>
              )}
            </span>
          </div>
        </div>

        {!capabilities && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            Printer capabilities not available. Ensure PrintNode client is running and printer is online.
          </div>
        )}
      </CardContent>
    </Card>
  );
}