import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Package, Scan, Users, Clock, Printer, RefreshCw } from "lucide-react";
import { useStationSession } from "@/hooks/useStationSession";
import { useNavigate } from "react-router-dom";
import { StationHeader } from "@/components/layout/StationHeader";
import { toast } from "@/hooks/use-toast";

export default function StationPage() {
  const { logout, role, allowedPaths, refetchSession, refreshPermissions } = useStationSession();
  const navigate = useNavigate();

  const handleRefreshAccess = async () => {
    try {
      const result = await refreshPermissions();
      if (result.success) {
        toast({
          title: "Access refreshed",
          description: "Your station permissions have been updated.",
        });
      } else {
        toast({
          title: "Refresh failed",
          description: result.error === 'missing_token' || result.error === 'invalid_token' 
            ? "Please sign in again at /station-login"
            : "Could not refresh your access. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Could not refresh your access. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stationTools = [
    {
      title: "Time Clock",
      description: "Clock in/out and manage breaks",
      icon: Clock,
      action: () => navigate('/station/clock'),
      disabled: false,
      path: "/station/clock"
    },
    {
      title: "Quick Intake", 
      description: "Scan and log incoming products",
      icon: Scan,
      action: () => navigate('/station/intake'),
      disabled: false,
      path: "/station/intake"
    },
    {
      title: "Inventory Check",
      description: "Verify product quantities", 
      icon: Package,
      action: () => navigate('/station/inventory'),
      disabled: false,
      path: "/station/inventory"
    },
    {
      title: "Label Printing",
      description: "Print product labels and barcodes",
      icon: Printer,
      action: () => navigate('/label-print'),
      disabled: false,
      path: "/label-print"
    },
    {
      title: "Staff Tools",
      description: "Access staff functions",
      icon: Users,
      action: () => navigate('/station/staff'),
      disabled: role !== 'admin',
      path: "/station/staff"
    }
  ];

  // Filter tools based on allowed paths
  const availableTools = stationTools.filter(tool => 
    allowedPaths?.includes(tool.path) || tool.path === undefined
  );

  // Get readable names for allowed paths
  const getPathName = (path: string) => {
    const tool = stationTools.find(t => t.path === path);
    return tool?.title || path;
  };

  return (
    <div className="min-h-screen bg-background">
      <StationHeader />

      <main className="p-6">
        {/* Status Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 bg-primary rounded-full"></span>
              <span>{availableTools.length} tool{availableTools.length !== 1 ? 's' : ''} available</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAccess}
              className="gap-2"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh Access
            </Button>
          </div>
          
          {/* Active Permissions */}
          {allowedPaths && allowedPaths.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Access:</span>
              {allowedPaths.slice(0, 3).map((path) => (
                <Badge key={path} variant="secondary" className="text-xs">
                  {getPathName(path)}
                </Badge>
              ))}
              {allowedPaths.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{allowedPaths.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Tools Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availableTools.map((tool) => (
            <Card 
              key={tool.title} 
              className={`group cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] border-2 ${
                tool.disabled 
                  ? 'opacity-50 cursor-not-allowed border-muted' 
                  : 'hover:border-primary/50 hover:bg-gradient-to-br hover:from-card hover:to-muted/30'
              }`}
              onClick={tool.disabled ? undefined : tool.action}
            >
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className={`p-2 rounded-lg transition-colors ${
                  tool.disabled 
                    ? 'bg-muted' 
                    : 'bg-primary/10 group-hover:bg-primary/20'
                }`}>
                  <tool.icon className={`h-6 w-6 ${
                    tool.disabled ? 'text-muted-foreground' : 'text-primary'
                  }`} />
                </div>
                <div className="ml-4">
                  <CardTitle className="text-lg">{tool.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{tool.description}</p>
                {tool.disabled && (
                  <p className="text-xs text-destructive mt-2">
                    Requires elevated permissions
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Tools Available Message */}
        {availableTools.length === 0 && (
          <div className="mt-8">
            <Card className="border-destructive/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="mb-4">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Tools Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Your station code doesn't currently allow access to any tools. 
                    Contact an administrator to update your permissions.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button onClick={handleRefreshAccess} variant="outline" className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Check Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Overview Card */}
        {availableTools.length > 0 && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Station Terminal Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Welcome to your station interface. Your access level is{' '}
                  <Badge variant="outline" className="mx-1">{role}</Badge>
                  with {availableTools.length} tool{availableTools.length !== 1 ? 's' : ''} available.
                </p>
                
                {/* Available Tools List */}
                <div className="flex flex-wrap gap-2">
                  {availableTools.map((tool) => (
                    <Badge key={tool.title} variant="secondary">
                      {tool.title}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}