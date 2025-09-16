import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Users, Settings, FileText, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStationSession } from "@/hooks/useStationSession";

export default function StationStaffPage() {
  const navigate = useNavigate();
  const { logout, role } = useStationSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/station')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Station
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Staff Tools</h1>
              <p className="text-sm text-muted-foreground">Role: {role}</p>
            </div>
          </div>
          <Button variant="outline" onClick={logout} className="gap-2">
            Logout
          </Button>
        </div>
      </header>

      <main className="p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <CardTitle className="text-lg">Staff Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Manage staff schedules and assignments
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <FileText className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <CardTitle className="text-lg">Reports</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Generate and view station reports
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <CardTitle className="text-lg">Analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View performance metrics and analytics
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Settings className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <CardTitle className="text-lg">Station Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Configure station preferences and settings
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Staff Administration Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Administrative tools for staff members with elevated permissions. 
                Access reports, analytics, and configuration options from this interface.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}