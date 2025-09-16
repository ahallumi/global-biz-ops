import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Search, Scan, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStationSession } from "@/hooks/useStationSession";

export default function StationInventoryPage() {
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
              <h1 className="text-2xl font-semibold">Inventory Check</h1>
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
              <Scan className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <CardTitle className="text-lg">Scan to Check</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Scan product barcode to verify quantities
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Search className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <CardTitle className="text-lg">Search Products</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Search and verify product information
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <ClipboardList className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <CardTitle className="text-lg">Count Sheet</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Generate and process inventory count sheets
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Verification Station</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Use the tools above to verify product quantities and maintain accurate inventory records. 
                This interface provides quick access to inventory checking functions.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}