import { useState } from 'react';
import { useProducts, useSearchProducts } from '@/hooks/useProducts';
import { useProductCandidates } from '@/hooks/useProductCandidates';
import { usePushProductsToSquare, usePullProductsFromSquare, useActiveSyncRun, useActiveImportRun } from '@/hooks/useProductSync';
import { useInventoryIntegrations, useImportProducts } from '@/hooks/useInventoryIntegrations';
import { useStagingData, useStagingStats, StagingItem } from '@/hooks/useStagingData';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Database } from '@/integrations/supabase/types';
import { Search, RefreshCw, Package, Upload } from 'lucide-react';
import { SplitButton } from '@/components/ui/split-button';
import { SyncStatusPopover } from '@/components/sync/SyncStatusPopover';
import { ImportStatusPopover } from '@/components/sync/ImportStatusPopover';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateActions } from '@/components/products/CandidateActions';
import { PlaceholderActions } from '@/components/products/PlaceholderActions';
import { StagingFilters } from '@/components/products/StagingFilters';
import { StagingAdminActions } from '@/components/products/StagingAdminActions';

type Product = Database['public']['Tables']['products']['Row'];

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('catalog');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Product hooks - now filtered by catalog status
  const { data: products, isLoading: isLoadingProducts, refetch: refetchProducts } = useProducts('ACTIVE');
  const { data: searchResults, isLoading: isSearching } = useSearchProducts(searchQuery, 'ACTIVE');
  
  // Staging hooks
  const { data: stagingData, isLoading: isLoadingStaging, refetch: refetchStaging } = useStagingData();
  const { data: stagingStats } = useStagingStats();
  
  const pushToSquare = usePushProductsToSquare();
  const { mutate: importProducts, isPending: isImportPending } = useImportProducts();
  
  // Active operation detection
  const { data: activeSyncRun } = useActiveSyncRun();
  const { data: activeImportRun } = useActiveImportRun();
  
  // Integration
  const { data: integrations } = useInventoryIntegrations();

  const displayedProducts = searchQuery.trim() ? searchResults || [] : products || [];

  // Filter staging data
  const filteredStagingData = stagingData?.filter(item => {
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'candidate' && item.type !== 'CANDIDATE') return false;
      if (sourceFilter === 'placeholder' && item.type !== 'PLACEHOLDER') return false;
    }
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  }) || [];

  // Show all staging data by default - let users apply filters explicitly
  const displayedStagingData = filteredStagingData;

  // Product columns with origin and sync state
  const productColumns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium">{product.name}</div>
            {product.brand && <div className="text-sm text-muted-foreground">{product.brand}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: 'upc',
      header: 'UPC/PLU',
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.original.upc || row.original.plu || 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: 'unit_of_sale',
      header: 'Unit',
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue('unit_of_sale')}</Badge>
      ),
    },
    {
      accessorKey: 'retail_price_cents',
      header: 'Retail Price',
      cell: ({ row }) => {
        const cents = row.getValue('retail_price_cents') as number;
        return cents ? `$${(cents / 100).toFixed(2)}` : 'N/A';
      },
    },
    {
      accessorKey: 'default_cost_cents',
      header: 'Default Cost',
      cell: ({ row }) => {
        const cents = row.getValue('default_cost_cents') as number;
        return cents ? `$${(cents / 100).toFixed(2)}` : 'N/A';
      },
    },
    {
      accessorKey: 'origin',
      header: 'Origin',
      cell: ({ row }) => {
        const origin = row.getValue('origin') as string;
        const variant = origin === 'SQUARE' ? 'default' : origin === 'MERGED' ? 'secondary' : 'outline';
        return <Badge variant={variant}>{origin}</Badge>;
      },
    },
    {
      accessorKey: 'sync_state',
      header: 'Sync State',
      cell: ({ row }) => {
        const state = row.getValue('sync_state') as string;
        const getVariant = (state: string) => {
          switch (state) {
            case 'SYNCED': return 'default';
            case 'DIVERGED': return 'destructive';
            case 'LOCAL_ONLY': return 'secondary';
            default: return 'outline';
          }
        };
        return <Badge variant={getVariant(state)}>{state.replace('_', ' ')}</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const product = row.original;
        const canPush = product.sync_state === 'LOCAL_ONLY' || product.sync_state === 'DIVERGED';
        
        return (
          <div className="flex items-center gap-2">
            {canPush && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => pushToSquare.mutate([product.id])}
                disabled={pushToSquare.isPending}
              >
                <Upload className="h-3 w-3 mr-1" />
                Push
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Staging columns (unified candidates and placeholders)
  const stagingColumns: ColumnDef<StagingItem>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const item = row.original;
        const variant = item.type === 'CANDIDATE' ? 'default' : 'secondary';
        return <Badge variant={variant}>{item.type === 'CANDIDATE' ? 'Candidate' : 'Legacy'}</Badge>;
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => {
        const item = row.original;
        let sourceText = item.source;
        if (item.type === 'PLACEHOLDER') sourceText = 'Legacy Placeholder';
        return <Badge variant="outline">{sourceText}</Badge>;
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium">{item.name || 'Unnamed'}</div>
            {item.type === 'CANDIDATE' && item.intake && (
              <div className="text-sm text-muted-foreground">
                From intake: {item.intake.invoice_number}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'upc',
      header: 'UPC/PLU',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="font-mono text-sm">
            {item.upc || item.plu || 'N/A'}
          </div>
        );
      },
    },
    {
      accessorKey: 'unit_of_sale',
      header: 'Unit',
      cell: ({ row }) => {
        const item = row.original;
        return item.unit_of_sale ? (
          <Badge variant="outline">{item.unit_of_sale}</Badge>
        ) : 'N/A';
      },
    },
    {
      accessorKey: 'suggested_cost_cents',
      header: 'Cost',
      cell: ({ row }) => {
        const item = row.original;
        const cents = item.suggested_cost_cents;
        return cents ? `$${(cents / 100).toFixed(2)}` : 'N/A';
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original;
        const getVariant = (status: string) => {
          switch (status) {
            case 'APPROVED': return 'default';
            case 'REJECTED': return 'destructive';
            case 'MERGED': return 'secondary';
            case 'PENDING': return 'outline';
            case 'PLACEHOLDER': return 'secondary';
            case 'ARCHIVED': return 'secondary';
            default: return 'outline';
          }
        };
        return <Badge variant={getVariant(item.status)}>{item.status}</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const item = row.original;
        
        if (item.type === 'CANDIDATE') {
          return <CandidateActions candidate={item.original_data} />;
        } else {
          return <PlaceholderActions product={item.original_data} />;
        }
      },
    },
  ];

  // Sync runs columns
  const syncRunColumns: ColumnDef<any>[] = [];

  const handleRefresh = () => {
    if (activeTab === 'catalog') {
      refetchProducts();
    } else if (activeTab === 'staging') {
      refetchStaging();
    }
  };

  const handleClearFilters = () => {
    setSourceFilter('all');
    setStatusFilter('all');
  };

  const handlePushAll = () => {
    const localOnlyProducts = products?.filter(p => p.sync_state === 'LOCAL_ONLY').map(p => p.id) || [];
    if (localOnlyProducts.length > 0) {
      pushToSquare.mutate(localOnlyProducts);
    }
  };

  const handleNavigateToSyncQueue = () => {
    // Navigate to the dedicated sync queue page
    window.location.href = '/sync-queue';
  };

  const activeIntegration = integrations?.find(i => i.provider === 'SQUARE');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage your product catalog, candidates, and POS sync
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SplitButton
              onClick={() => {
                if (activeIntegration?.id) {
                  importProducts({ integrationId: activeIntegration.id, mode: 'FULL' })
                }
              }}
              disabled={isImportPending || !activeIntegration?.id}
              variant="outline"
              isActive={!!activeImportRun}
              activeLabel={activeImportRun?.status === 'RUNNING' ? 'Importing...' : 'Queued'}
              popoverContent={<ImportStatusPopover onNavigateToSyncQueue={handleNavigateToSyncQueue} />}
            >
              <Package className={`h-4 w-4 mr-2 ${isImportPending ? 'animate-spin' : ''}`} />
              Import from Square
            </SplitButton>
            
            <SplitButton
              onClick={handlePushAll}
              disabled={pushToSquare.isPending}
              variant="outline"
              isActive={!!activeSyncRun}
              activeLabel={activeSyncRun?.status === 'RUNNING' ? 'Syncing...' : 'Queued'}
              popoverContent={<SyncStatusPopover onNavigateToSyncQueue={handleNavigateToSyncQueue} />}
            >
              <Upload className={`h-4 w-4 mr-2 ${pushToSquare.isPending ? 'animate-spin' : ''}`} />
              Push All Local
            </SplitButton>
            
            <Button
              onClick={handleRefresh}
              disabled={isLoadingProducts || isLoadingStaging}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(isLoadingProducts || isLoadingStaging) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
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
                {activeIntegration.last_success_at && (
                  <span className="text-sm text-muted-foreground">
                    Last sync: {new Date(activeIntegration.last_success_at).toLocaleString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog">
              Catalog ({products?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="staging">
              Staging ({stagingStats?.totalStaging || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            {/* Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products by name, SKU, UPC, or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
              <CardHeader>
                <CardTitle>Live Catalog ({displayedProducts.length})</CardTitle>
                <CardDescription>
                  {searchQuery.trim() 
                    ? `Search results for "${searchQuery}"`
                    : 'Active products available for sale'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingProducts || isSearching ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <DataTable 
                    columns={productColumns} 
                    data={displayedProducts}
                    searchKey="name"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staging" className="space-y-4">
            <StagingAdminActions />
            
            <Card>
              <CardHeader>
                <CardTitle>Staging Area</CardTitle>
                <CardDescription>
                  Product candidates and legacy placeholders that need action to move into your live catalog.
                  Use filters to narrow down the view as needed.
                </CardDescription>
                {/* Debug Info */}
                {stagingData && (
                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                    <strong>Debug:</strong> Loaded {stagingData.length} total items • 
                    Displaying {displayedStagingData.length} after filters • 
                    Raw candidates: {stagingData.filter(i => i.type === 'CANDIDATE').length} • 
                    Raw placeholders: {stagingData.filter(i => i.type === 'PLACEHOLDER').length}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <StagingFilters
                  sourceFilter={sourceFilter}
                  statusFilter={statusFilter}
                  onSourceFilterChange={setSourceFilter}
                  onStatusFilterChange={setStatusFilter}
                  onClearFilters={handleClearFilters}
                  stats={{
                    total: stagingData?.length || 0,
                    filtered: displayedStagingData.length
                  }}
                />
                <div className="p-6">
                  {isLoadingStaging ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <DataTable 
                        columns={stagingColumns} 
                        data={displayedStagingData}
                        searchKey="name"
                      />
                      
                      {/* Debug fallback - if data exists but table is empty */}
                      {stagingData && stagingData.length > 0 && displayedStagingData.length === 0 && (
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                          <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Debug: Data Present But Hidden</h4>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            Found {stagingData.length} items but filters are hiding them all. First 3 items:
                          </p>
                          <div className="mt-2 space-y-1 text-xs">
                            {stagingData.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="font-mono bg-yellow-100 dark:bg-yellow-900/40 p-1 rounded">
                                {item.type}: {item.name} | Status: {item.status} | Source: {item.source}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
