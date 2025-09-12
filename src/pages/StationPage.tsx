import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Package, Scan, Users } from "lucide-react";
import { useStationSession } from "@/hooks/useStationSession";

export default function StationPage() {
  const { logout, role } = useStationSession();

  const stationTools = [
    {
      title: "Quick Intake",
      description: "Scan and log incoming products",
      icon: Scan,
      action: () => console.log("Quick Intake"),
      disabled: false
    },
    {
      title: "Inventory Check",
      description: "Verify product quantities",
      icon: Package,
      action: () => console.log("Inventory Check"),
      disabled: false
    },
    {
      title: "Staff Tools",
      description: "Access staff functions",
      icon: Users,
      action: () => console.log("Staff Tools"),
      disabled: role !== 'admin'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Station Terminal</h1>
            <p className="text-sm text-muted-foreground">Role: {role}</p>
          </div>
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {stationTools.map((tool) => (
            <Card 
              key={tool.title} 
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                tool.disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={tool.disabled ? undefined : tool.action}
            >
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <tool.icon className="h-8 w-8 text-primary" />
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

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Station Terminal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This is your station interface. Use the tools above to perform various operations.
                The interface will be expanded with actual functionality based on your needs.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}