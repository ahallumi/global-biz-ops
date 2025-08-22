import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useInventoryIntegrations, useUpdateInventoryIntegration, useCreateInventoryIntegration, useTestConnection, useImportProducts } from '@/hooks/useInventoryIntegrations';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Package, Upload, Download } from 'lucide-react';

const integrationSchema = z.object({
  environment: z.enum(['SANDBOX', 'PRODUCTION']),
  access_token: z.string(),
  auto_import_enabled: z.boolean(),
  auto_import_interval_minutes: z.number().min(15).max(1440),
  auto_push_enabled: z.boolean(), // Use the real boolean flag
});

export default function InventorySettingsPage() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<any>(null);

  const { data: integrations, isLoading: isLoadingIntegrations } = useInventoryIntegrations();
  const updateIntegration = useUpdateInventoryIntegration();
  const createIntegration = useCreateInventoryIntegration();
  const testConnection = useTestConnection();
  const importProducts = useImportProducts();

  const activeIntegration = integrations?.[0];

  const form = useForm<z.infer<typeof integrationSchema>>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      environment: 'PRODUCTION',
      access_token: '',
      auto_import_enabled: false,
      auto_import_interval_minutes: 180,
      auto_push_enabled: false, // Use the real boolean flag
    },
  });

  useEffect(() => {
    if (activeIntegration) {
      form.reset({
        environment: activeIntegration.environment as 'SANDBOX' | 'PRODUCTION',
        access_token: '',
        auto_import_enabled: activeIntegration.auto_import_enabled,
        auto_import_interval_minutes: activeIntegration.auto_import_interval_minutes,
        auto_push_enabled: activeIntegration.auto_push_enabled, // Use the real boolean flag
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

  const handleImportProducts = async (mode: 'FULL' | 'DELTA') => {
    try {
      if (!activeIntegration) {
        throw new Error('No integration configured. Save settings first.');
      }

      await importProducts.mutateAsync({ integrationId: activeIntegration.id, mode });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof integrationSchema>) => {
    try {
      if (activeIntegration) {
        await updateIntegration.mutateAsync({
          id: activeIntegration.id,
          environment: values.environment,
          auto_import_enabled: values.auto_import_enabled,
          auto_import_interval_minutes: values.auto_import_interval_minutes,
          auto_push_enabled: values.auto_push_enabled, // Use the real boolean flag
        });

        if (values.access_token.trim()) {
          const response = await supabase.functions.invoke('inventory-save-credentials', {
            body: {
              integrationId: activeIntegration.id,
              accessToken: values.access_token,
            }
          });

          if (response.error) {
            throw new Error(response.error.message);
          }
        }
      } else {
        if (!values.access_token.trim()) {
          throw new Error('Access token is required for new integrations');
        }

        const newIntegration = await createIntegration.mutateAsync({
          provider: 'SQUARE',
          environment: values.environment,
          auto_import_enabled: values.auto_import_enabled,
          auto_import_interval_minutes: values.auto_import_interval_minutes,
          auto_push_enabled: values.auto_push_enabled, // Use the real boolean flag
        });

        const response = await supabase.functions.invoke('inventory-save-credentials', {
          body: {
            integrationId: newIntegration.id,
            accessToken: values.access_token,
          }
        });

        if (response.error) {
          throw new Error(response.error.message);
        }
      }

      toast({
        title: 'Success',
        description: 'Integration settings saved successfully',
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
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Integration</h1>
          <p className="text-muted-foreground">
            Configure Square POS integration for automatic product sync
          </p>
        </div>

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
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Environment: {activeIntegration.environment}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Auto Import: {activeIntegration.auto_import_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Auto Push: {activeIntegration.auto_push_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {activeIntegration.last_success_at ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Last successful sync: {new Date(activeIntegration.last_success_at).toLocaleString()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 text-red-500" />
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
                  name="access_token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Token</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Paste your Square access token here"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter your Square access token. Keep it safe!
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
                            Automatically push approved products to Square
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
                      name="auto_import_interval_minutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Import Interval (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="15"
                              max="1440"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            How often to check for new products (15 minutes to 24 hours)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateIntegration.isPending || createIntegration.isPending}
                  >
                    {updateIntegration.isPending || createIntegration.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Test Connection</CardTitle>
              <CardDescription>
                Verify your Square integration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleTestConnection} disabled={isTestingConnection}>
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </Button>
              {connectionResult && (
                <div className="space-y-2">
                  {connectionResult.ok ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Connected to {connectionResult.locations?.length || 0} Square location(s)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Connection failed: {connectionResult.error || 'Unknown error'}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Products</CardTitle>
              <CardDescription>
                Import products from Square to seed your catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => handleImportProducts('FULL')} disabled={importProducts.isLoading}>
                <Download className="h-4 w-4 mr-2" />
                Full Import
              </Button>
              <Button onClick={() => handleImportProducts('DELTA')} disabled={importProducts.isLoading} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Delta Import
              </Button>
              <p className="text-sm text-muted-foreground">
                Full import will overwrite existing products. Delta import will only add new products.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
