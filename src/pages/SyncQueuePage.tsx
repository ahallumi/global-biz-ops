import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { useProductSyncRuns, useProductImportRuns } from '@/hooks/useProductSync';
import { useInventoryIntegrations } from '@/hooks/useInventoryIntegrations';
import { Skeleton } from '@/components/ui/skeleton';
import { History, Package, Upload, Download, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function SyncQueuePage() {
  // Sync hooks
  const { data: syncRuns, isLoading: isLoadingSyncRuns } = useProductSyncRuns();
  const { data: importRuns, isLoading: isLoadingImportRuns } = useProductImportRuns();
  
  // Integration
  const { data: integrations } = useInventoryIntegrations();

  // Sync runs columns
  const syncRunColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'direction',
      header: 'Direction',
      cell: ({ row }) => {
        const direction = row.getValue('direction') as string;
        const isOut = direction === 'OUT';
        return (
          <Badge variant={isOut ? 'secondary' : 'default'} className="gap-1">
            {isOut ? <Upload className="h-3 w-3" /> : <Download className="h-3 w-3" />}
            {isOut ? 'Push' : 'Pull'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const getVariant = (status: string) => {
          switch (status) {
            case 'COMPLETED': return 'default';
            case 'FAILED': return 'destructive';
            case 'PENDING': return 'secondary';
            default: return 'outline';
          }
        };
        const getIcon = (status: string) => {
          switch (status) {
            case 'COMPLETED': return <CheckCircle className="h-3 w-3" />;
            case 'FAILED': return <XCircle className="h-3 w-3" />;
            case 'PENDING': return <Clock className="h-3 w-3" />;
            default: return null;
          }
        };
        return (
          <Badge variant={getVariant(status)} className="gap-1">
            {getIcon(status)}
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'started_at',
      header: 'Started',
      cell: ({ row }) => {
        const date = row.getValue('started_at') as string;
        return new Date(date).toLocaleString();
      },
    },
    {
      accessorKey: 'processed_count',
      header: 'Processed',
    },
    {
      accessorKey: 'created_count',
      header: 'Created',
    },
    {
      accessorKey: 'updated_count',
      header: 'Updated',
    },
  ];

  const activeIntegration = integrations?.find(i => i.provider === 'SQUARE');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sync Queue</h1>
            <p className="text-muted-foreground">
              Monitor sync operations and data flow with Square POS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        {/* Integration Status */}
        {activeIntegration && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Square Integration Status
              </CardTitle>
              <CardDescription>
                Current status of your Square POS integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Badge variant={activeIntegration.last_success_at ? 'default' : 'destructive'}>
                  {activeIntegration.last_success_at ? 'Connected' : 'Disconnected'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Environment: {activeIntegration.environment}
                </span>
                {activeIntegration.auto_push_enabled && (
                  <Badge variant="secondary">Auto-Push Enabled</Badge>
                )}
                {activeIntegration.auto_import_enabled && (
                  <Badge variant="secondary">Auto-Import Enabled</Badge>
                )}
                {activeIntegration.last_success_at && (
                  <span className="text-sm text-muted-foreground">
                    Last sync: {new Date(activeIntegration.last_success_at).toLocaleString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sync Runs (Push)</CardTitle>
              <CardDescription>Recent push operations to Square</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSyncRuns ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <DataTable 
                  columns={syncRunColumns} 
                  data={syncRuns || []}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Runs (Pull)</CardTitle>
              <CardDescription>Recent import operations from Square</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingImportRuns ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <DataTable 
                  columns={syncRunColumns} 
                  data={importRuns || []}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}