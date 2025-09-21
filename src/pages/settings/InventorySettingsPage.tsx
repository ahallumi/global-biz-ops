import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useInventoryIntegrations, useUpdateInventoryIntegration, useCreateInventoryIntegration, useTestConnection, useImportProducts, useCredentialStatus, useSaveCredentials } from '@/hooks/useInventoryIntegrations';
import { useImportProgress } from '@/hooks/useImportProgress';
import { ImportProgressDialog } from '@/components/imports/ImportProgressDialog';
import { AlertCircle, CheckCircle, Package, Upload, Download, Key, Shield, Loader2, Trash2 } from 'lucide-react';
import { CatalogResetDialog } from '@/components/products/CatalogResetDialog';
import { Badge } from '@/components/ui/badge';

const integrationSchema = z.object({
  environment: z.enum(['SANDBOX', 'PRODUCTION']),
  catalog_mode: z.enum(['SEARCH', 'LIST']),
  access_token: z.string(),
  auto_import_enabled: z.boolean(),
  auto_import_interval_hours: z.number().min(0.25).max(24), // 15 minutes to 24 hours
  auto_push_enabled: z.boolean(),
});

export default function InventorySettingsPage() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState<'START' | 'RESUME'>('START');
  const [showResetDialog, setShowResetDialog] = useState(false);

  const { data: integrations, isLoading: isLoadingIntegrations } = useInventoryIntegrations();
  const updateIntegration = useUpdateInventoryIntegration();
  const createIntegration = useCreateInventoryIntegration();
  const testConnection = useTestConnection();
  const importProducts = useImportProducts();
  const saveCredentials = useSaveCredentials();

  const activeIntegration = integrations?.[0];
  const { data: credentialStatus } = useCredentialStatus(activeIntegration?.id);
  const { currentImport, isImporting } = useImportProgress(activeIntegration?.id);

  const form = useForm<z.infer<typeof integrationSchema>>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      environment: 'PRODUCTION',
      catalog_mode: 'SEARCH',
      access_token: '',
      auto_import_enabled: false,
      auto_import_interval_hours: 3,
      auto_push_enabled: false,
    },
  });

  useEffect(() => {
    if (activeIntegration) {
      form.reset({
        environment: activeIntegration.environment as 'SANDBOX' | 'PRODUCTION',
        catalog_mode: (activeIntegration.catalog_mode as 'SEARCH' | 'LIST') || 'SEARCH',
        access_token: '',
        auto_import_enabled: activeIntegration.auto_import_enabled,
        auto_import_interval_hours: activeIntegration.auto_import_interval_minutes / 60,
        auto_push_enabled: activeIntegration.auto_push_enabled,
      });
    }
  }, [activeIntegration, form]);

  const { toast } = useToast();

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);

    try {
      if (!activeIntegration) {
        throw new Error('No integration configured. Save settings first.');
      }

      const result = await testConnection.mutateAsync(activeIntegration.id);
      setConnectionResult(result);
    } catch (error: any) {
      setConnectionResult({ error: error.message });
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleImportProducts = async (mode: 'START' | 'RESUME') => {
    try {
      if (!activeIntegration) {
        throw new Error('No integration configured. Save settings first.');
      }

      setImportMode(mode);
      setShowImportDialog(true);
      await importProducts.mutateAsync({ integrationId: activeIntegration.id, mode });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setShowImportDialog(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof integrationSchema>) => {
    try {
      if (activeIntegration) {
        await updateIntegration.mutateAsync({
          id: activeIntegration.id,
          environment: values.environment,
          catalog_mode: values.catalog_mode,
          auto_import_enabled: values.auto_import_enabled,
          auto_import_interval_minutes: Math.round(values.auto_import_interval_hours * 60),
          auto_push_enabled: values.auto_push_enabled,
        });

        if (values.access_token.trim()) {
          await saveCredentials.mutateAsync({
            integrationId: activeIntegration.id,
            accessToken: values.access_token,
            provider: 'SQUARE',
            environment: values.environment
          });
        }
      } else {
        if (!values.access_token.trim()) {
          throw new Error('Access token is required for new integrations');
        }

        const newIntegration = await createIntegration.mutateAsync({
          provider: 'SQUARE',
          environment: values.environment,
          catalog_mode: values.catalog_mode,
          auto_import_enabled: values.auto_import_enabled,
          auto_import_interval_minutes: Math.round(values.auto_import_interval_hours * 60),
          auto_push_enabled: values.auto_push_enabled,
        });

        await saveCredentials.mutateAsync({
          integrationId: newIntegration.id,
          accessToken: values.access_token,
          provider: 'SQUARE',
          environment: values.environment
        });
      }

      form.setValue('access_token', '');
      
      toast({
        title: 'Success',
        description: 'Integration settings and credentials saved successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <SettingsLayout 
      title="Inventory Settings"
      description="Configure Square POS integration for automatic product sync"
    >
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Integration Status
            </CardTitle>
            <CardDescription>
              Current status of your Square POS integration
            </CardDescription>
          </CardHeader>
           <CardContent>
             {isLoadingIntegrations ? (
               <p>Loading...</p>
             ) : activeIntegration ? (
               <div className="space-y-3">
                 <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      Environment: {activeIntegration.environment}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Catalog Mode: {activeIntegration.catalog_mode || 'SEARCH'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Auto Import: {activeIntegration.auto_import_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Auto Push: {activeIntegration.auto_push_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                 </div>
                 
                 {/* Credential Status */}
                 <div className="flex items-center gap-2 text-sm">
                   {credentialStatus?.hasCredentials ? (
                     <>
                       <CheckCircle className="h-4 w-4 text-success" />
                       <span className="text-muted-foreground">API credentials configured</span>
                       {credentialStatus?.lastUpdated && (
                         <span className="text-muted-foreground">
                           (updated {new Date(credentialStatus.lastUpdated).toLocaleDateString()})
                         </span>
                       )}
                     </>
                   ) : (
                     <>
                       <AlertCircle className="h-4 w-4 text-warning" />
                       <span className="text-muted-foreground">API credentials missing</span>
                     </>
                   )}
                 </div>
                 
                  {/* Current Import Status */}
                  {isImporting && currentImport && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Import in Progress
                      </div>
                      <div className="text-sm text-primary/80">
                        {currentImport.processed_count > 0 
                          ? `Processing... ${currentImport.processed_count} products processed`
                          : 'Fetching products from Square...'
                        }
                      </div>
                      <div className="flex gap-4 text-xs text-primary/70">
                        <span>Created: {currentImport.created_count}</span>
                        <span>Updated: {currentImport.updated_count}</span>
                      </div>
                    </div>
                  )}
                  
                  {activeIntegration.last_success_at ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Last successful sync: {new Date(activeIntegration.last_success_at).toLocaleString()}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      No successful sync yet
                    </div>
                  )}
               </div>
             ) : (
               <p>No integration configured</p>
             )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Square Integration Settings</CardTitle>
            <CardDescription>
              Configure your Square POS integration for seamless inventory management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <FormField
                   control={form.control}
                   name="environment"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Environment</FormLabel>
                       <FormControl>
                         <select
                           className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                           {...field}
                         >
                           <option value="PRODUCTION">Production</option>
                           <option value="SANDBOX">Sandbox</option>
                         </select>
                       </FormControl>
                       <FormDescription>
                         Choose the Square environment to connect to
                       </FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 <FormField
                   control={form.control}
                   name="catalog_mode"
                   render={({ field }) => (
                     <FormItem>
                       <FormLabel>Catalog Source Mode</FormLabel>
                       <FormControl>
                         <select
                           className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                           {...field}
                         >
                           <option value="SEARCH">Search (strict)</option>
                           <option value="LIST">List (compatible)</option>
                         </select>
                       </FormControl>
                       <FormDescription>
                         <strong>Search (strict)</strong>: Faster + deterministic; requires Square Catalog Search access.<br/>
                         <strong>List (compatible)</strong>: Works on all Square accounts; deterministic per-page processing.
                       </FormDescription>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                <FormField
                  control={form.control}
                  name="access_token"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Access Token</FormLabel>
                        {credentialStatus?.hasCredentials && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Credentials Stored
                          </Badge>
                        )}
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={
                            credentialStatus?.hasCredentials 
                              ? "••••••••••••••••••••••• (Leave empty to keep existing)" 
                              : "Paste your Square access token here"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter your Square <strong>Access Token</strong> (not Application ID). Get this from your Square Developer Dashboard → Applications → [Your App] → Production/Sandbox → Access Token.
                        {credentialStatus?.hasCredentials && credentialStatus?.lastUpdated && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            Last updated: {new Date(credentialStatus.lastUpdated).toLocaleDateString()}
                          </div>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Automation Settings</h3>
                  
                  <FormField
                    control={form.control}
                    name="auto_import_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Auto Import</FormLabel>
                          <FormDescription>
                            Automatically import products from Square at regular intervals
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="auto_push_enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Auto Push</FormLabel>
                          <FormDescription>
                            Automatically push product updates to Square when products are modified
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('auto_import_enabled') && (
                    <FormField
                      control={form.control}
                      name="auto_import_interval_hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Import Interval (hours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0.25"
                              max="24"
                              step="0.25"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            How often to automatically import products (minimum 15 minutes, maximum 24 hours)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={!activeIntegration || isTestingConnection}
                    >
                      {isTestingConnection ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Key className="mr-2 h-4 w-4" />
                          Test Connection
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleImportProducts('START')}
                      disabled={!activeIntegration || isImporting}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Import Products
                    </Button>

                    {currentImport && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleImportProducts('RESUME')}
                        disabled={!activeIntegration || !isImporting}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Resume Import
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setShowResetDialog(true)}
                      disabled={!activeIntegration}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Reset Catalog
                    </Button>
                  </div>

                  <Button type="submit">
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>

            {/* Connection Test Results */}
            {connectionResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {connectionResult.error ? (
                      <>
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        Connection Failed
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-5 w-5 text-success" />
                        Connection Successful
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {connectionResult.error ? (
                    <div className="text-sm text-destructive">
                      {connectionResult.error}
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div>
                        <strong>Application ID:</strong> {connectionResult.applicationId}
                      </div>
                      <div>
                        <strong>Application Name:</strong> {connectionResult.applicationName}
                      </div>
                      <div>
                        <strong>Environment:</strong> {connectionResult.environment}
                      </div>
                      {connectionResult.locationId && (
                        <div>
                          <strong>Location ID:</strong> {connectionResult.locationId}
                        </div>
                      )}
                      {connectionResult.merchantName && (
                        <div>
                          <strong>Merchant:</strong> {connectionResult.merchantName}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>

      <ImportProgressDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        mode={importMode}
        integrationId={activeIntegration?.id}
      />

      <CatalogResetDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
      />
    </SettingsLayout>
  );
}