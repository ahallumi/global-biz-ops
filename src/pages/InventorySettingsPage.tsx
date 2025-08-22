import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useInventoryIntegrations, useCreateInventoryIntegration, useUpdateInventoryIntegration, useTestConnection, useImportProducts, useProductImportRuns } from '@/hooks/useInventoryIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Settings, Square, TestTube2, Download, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function InventorySettingsPage() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const { data: integrations = [], refetch } = useInventoryIntegrations();
  const { data: importRuns = [] } = useProductImportRuns();
  const createIntegration = useCreateInventoryIntegration();
  const updateIntegration = useUpdateInventoryIntegration();
  const testConnection = useTestConnection();
  const importProducts = useImportProducts();

  const [accessToken, setAccessToken] = useState('');
  const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('PRODUCTION');
  const [autoImportEnabled, setAutoImportEnabled] = useState(false);
  const [autoImportInterval, setAutoImportInterval] = useState(180);

  const currentIntegration = integrations[0]; // For now, we only support one Square integration

  useEffect(() => {
    if (currentIntegration) {
      setEnvironment(currentIntegration.environment as 'SANDBOX' | 'PRODUCTION');
      setAutoImportEnabled(currentIntegration.auto_import_enabled);
      setAutoImportInterval(currentIntegration.auto_import_interval_minutes);
    }
  }, [currentIntegration]);

  if (!employee || employee.role !== 'admin') {
    return (
      <Layout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need admin privileges to access inventory settings.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  const handleSaveCredentials = async () => {
    if (!accessToken.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an access token',
        variant: 'destructive',
      });
      return;
    }

    try {
      let integrationId = currentIntegration?.id;

      if (!currentIntegration) {
        // Create new integration
        const newIntegration = await createIntegration.mutateAsync({
          provider: 'SQUARE',
          environment,
          display_name: 'Square',
          created_by: employee.user_id,
        });
        integrationId = newIntegration.id;
      } else {
        // Update existing integration
        await updateIntegration.mutateAsync({
          id: currentIntegration.id,
          environment,
        });
      }

      // Save encrypted credentials via Edge Function
      const { error } = await supabase.functions.invoke('inventory-save-credentials', {
        body: {
          integrationId,
          provider: 'SQUARE',
          environment,
          accessToken,
        }
      });

      if (error) throw error;

      setAccessToken('');
      refetch();
      toast({
        title: 'Credentials Saved',
        description: 'Access token has been encrypted and stored securely',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save credentials',
        variant: 'destructive',
      });
    }
  };

  const handleTestConnection = async () => {
    if (!currentIntegration) {
      toast({
        title: 'Error',
        description: 'No integration found. Please save credentials first.',
        variant: 'destructive',
      });
      return;
    }

    testConnection.mutate(currentIntegration.id);
  };

  const handleUpdateAutoImport = async () => {
    if (!currentIntegration) return;

    updateIntegration.mutate({
      id: currentIntegration.id,
      auto_import_enabled: autoImportEnabled,
      auto_import_interval_minutes: autoImportInterval,
    });
  };

  const handleRunImport = () => {
    if (!currentIntegration) {
      toast({
        title: 'Error',
        description: 'No integration configured',
        variant: 'destructive',
      });
      return;
    }

    importProducts.mutate({ integrationId: currentIntegration.id });
  };

  const getConnectionStatus = () => {
    if (!currentIntegration) return { status: 'Never connected', variant: 'secondary' as const, icon: AlertCircle };
    if (currentIntegration.last_success_at && !currentIntegration.last_error) {
      return { status: 'Connected', variant: 'default' as const, icon: CheckCircle };
    }
    if (currentIntegration.last_error) {
      return { status: 'Error', variant: 'destructive' as const, icon: AlertCircle };
    }
    return { status: 'Never connected', variant: 'secondary' as const, icon: AlertCircle };
  };

  const lastImportRun = importRuns[0];
  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory Integration</h1>
            <p className="text-muted-foreground mt-1">
              Configure Square POS integration and product imports
            </p>
          </div>
        </div>

        {/* Integration Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Square className="w-5 h-5" />
              Integration Provider
            </CardTitle>
            <CardDescription>
              Configure your POS system integration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value="SQUARE" disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SQUARE">Square</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={(value: 'SANDBOX' | 'PRODUCTION') => setEnvironment(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SANDBOX">Sandbox</SelectItem>
                  <SelectItem value="PRODUCTION">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Credentials</CardTitle>
            <CardDescription>
              Securely store your Square access token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="Enter your Square access token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleSaveCredentials}
                disabled={createIntegration.isPending || updateIntegration.isPending}
              >
                {createIntegration.isPending || updateIntegration.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save & Encrypt
              </Button>
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={testConnection.isPending || !currentIntegration}
              >
                {testConnection.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <TestTube2 className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
              <Badge variant={connectionStatus.variant} className="flex items-center gap-1">
                <StatusIcon className="w-3 h-3" />
                {connectionStatus.status}
              </Badge>
            </div>
            {currentIntegration?.last_error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{currentIntegration.last_error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Auto Import */}
        <Card>
          <CardHeader>
            <CardTitle>Auto Import</CardTitle>
            <CardDescription>
              Configure automatic product synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable auto-import</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically sync products from Square
                </p>
              </div>
              <Switch
                checked={autoImportEnabled}
                onCheckedChange={setAutoImportEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Import Interval (minutes)</Label>
              <Select 
                value={autoImportInterval.toString()} 
                onValueChange={(value) => setAutoImportInterval(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                  <SelectItem value="720">12 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleUpdateAutoImport}
              disabled={updateIntegration.isPending}
            >
              {updateIntegration.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Save Settings
            </Button>
          </CardContent>
        </Card>

        {/* Manual Import */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Import</CardTitle>
            <CardDescription>
              Manually trigger product import from Square
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Run product import</p>
                <p className="text-sm text-muted-foreground">
                  Import all products from your Square catalog
                </p>
              </div>
              <Button 
                onClick={handleRunImport}
                disabled={importProducts.isPending || !currentIntegration}
              >
                {importProducts.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Run Now
              </Button>
            </div>
            
            {lastImportRun && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Last Import Run</span>
                  <Badge 
                    variant={lastImportRun.status === 'SUCCESS' ? 'default' : 
                            lastImportRun.status === 'FAILED' ? 'destructive' : 'secondary'}
                  >
                    {lastImportRun.status === 'RUNNING' ? (
                      <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Running</>
                    ) : lastImportRun.status === 'SUCCESS' ? (
                      <><CheckCircle className="w-3 h-3 mr-1" /> Success</>
                    ) : lastImportRun.status === 'FAILED' ? (
                      <><AlertCircle className="w-3 h-3 mr-1" /> Failed</>
                    ) : (
                      <><Clock className="w-3 h-3 mr-1" /> {lastImportRun.status}</>
                    )}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(lastImportRun.started_at), { addSuffix: true })}
                </div>
                {lastImportRun.status === 'SUCCESS' && (
                  <div className="text-sm">
                    Processed: {lastImportRun.processed_count} | 
                    Created: {lastImportRun.created_count} | 
                    Updated: {lastImportRun.updated_count}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}