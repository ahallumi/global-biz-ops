import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useProducts, useSearchProducts, useDeleteProducts } from '@/hooks/useProducts';
import { useProductCandidates } from '@/hooks/useProductCandidates';
import { usePushProductsToSquare, usePullProductsFromSquare, useActiveSyncRun, useActiveImportRun } from '@/hooks/useProductSync';
import { useInventoryIntegrations } from '@/hooks/useInventoryIntegrations';

import { Layout } from '@/components/layout/Layout';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Database } from '@/integrations/supabase/types';
import { Search, RefreshCw, Package, Upload, Trash2, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { SplitButton } from '@/components/ui/split-button';
import { SyncStatusPopover } from '@/components/sync/SyncStatusPopover';
import { ImportStatusPopover } from '@/components/sync/ImportStatusPopover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const StagingTab = lazy(() => import('./products/StagingTab'));

type Product = Database['public']['Tables']['products']['Row'];

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('catalog');
  const [rowSelection, setRowSelection] = useState({});
  
  // Safe mode disables heavy popovers and staging UI to isolate issues
  const isSafeMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('safe') === '1';
  
  // Product hooks - now filtered by catalog status
  const { data: products = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useProducts('ACTIVE');
  const { data: searchResults = [], isLoading: isSearching } = useSearchProducts(searchQuery, 'ACTIVE');
  
  
  const pushToSquare = usePushProductsToSquare();
  const pullFromSquare = usePullProductsFromSquare();
  const deleteProducts = useDeleteProducts();
  
  // Busy state prevents crashes during heavy operations
  const isBusy = deleteProducts.isPending || pushToSquare.isPending || pullFromSquare.isPending;
  
  // Active operation detection
  const { data: activeSyncRun } = useActiveSyncRun();
  const { data: activeImportRun } = useActiveImportRun();
  
  // Integration
  const { data: integrations } = useInventoryIntegrations();

  const displayedProducts = searchQuery.trim() ? searchResults || [] : products || [];
  const localOnlyCount = products?.filter(product => product.sync_state === 'LOCAL_ONLY').length || 0;

  // Memoized selection reconciliation to prevent feedback loops
  const reconcileSelection = useCallback((products: any[], currentSelection: Record<string, boolean>) => {
    if (products.length === 0) {
      return Object.keys(currentSelection).length > 0 ? {} : currentSelection;
    }
    
    const ids = new Set(products.map(p => p.id));
    const next: Record<string, boolean> = {};
    let changed = false;
    
    for (const key of Object.keys(currentSelection)) {
      if (ids.has(key)) {
        next[key] = true;
      } else {
        changed = true;
      }
    }
    
    return changed ? next : currentSelection;
  }, []);

  // Ensure selection never references rows that no longer exist (skip during busy operations)
  useEffect(() => {
    if (isBusy) return; // Skip reconciliation during busy operations
    
    const reconciledSelection = reconcileSelection(displayedProducts || [], rowSelection);
    if (reconciledSelection !== rowSelection) {
      setRowSelection(reconciledSelection);
    }
  }, [displayedProducts, reconcileSelection, isBusy]);

  // Selection helpers
  const selectedProductIds = Object.keys(rowSelection).filter(key => rowSelection[key]);
  const selectedProducts = selectedProductIds.map(id => displayedProducts.find(p => p.id === id)).filter(Boolean);
  const isAllSelected = displayedProducts.length > 0 && selectedProductIds.length === displayedProducts.length;
  const isIndeterminate = selectedProductIds.length > 0 && selectedProductIds.length < displayedProducts.length;
  console.log('Render diagnostic', { productsCount: products.length, displayedCount: displayedProducts.length, searchQuery, activeTab, selectedCount: selectedProductIds.length });
  const handleSelectAll = () => {
    if (isAllSelected) {
      setRowSelection({});
    } else {
      const newSelection = {};
      displayedProducts.forEach(product => {
        newSelection[product.id] = true;
      });
      setRowSelection(newSelection);
    }
  };

  const handleClearSelection = () => {
    setRowSelection({});
  };

  const handlePushSelected = () => {
    if (selectedProductIds.length > 0) {
      pushToSquare.mutate(selectedProductIds);
      handleClearSelection();
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProductIds.length > 0) {
      try {
        // Clear selection first to avoid rendering stale selections on empty data
        handleClearSelection();
        await deleteProducts.mutateAsync(selectedProductIds);
        await refetchProducts();
        // Small delay to let React Table settle
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        // Error toasts are handled in useDeleteProducts
      }
    }
  };


  // Product columns with selection and origin and sync state
  const productColumns: ColumnDef<Product>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
          onCheckedChange={handleSelectAll}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const product = row.original as Product | undefined;
        if (!product) return null;
        return (
          <div className="space-y-1">
            <div className="font-medium">{product?.name ?? 'Unnamed'}</div>
            {product?.brand && <div className="text-sm text-muted-foreground">{product.brand}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: 'upc',
      header: 'UPC/PLU',
      cell: ({ row }) => {
        const p = row.original as Product | undefined;
        return (
          <div className="font-mono text-sm">
            {p?.upc || p?.plu || 'N/A'}
          </div>
        );
      },
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
        const product = row.original as Product | undefined;
        if (!product) return null;
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


  // Sync runs columns
  const syncRunColumns: ColumnDef<any>[] = [];

  const handleRefresh = () => {
    if (activeTab === 'catalog') {
      refetchProducts();
    }
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
      <ErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Products</h1>
              <p className="text-muted-foreground">
                Manage your product catalog, candidates, and POS sync
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isBusy ? (
                <SplitButton
                  onClick={() => pullFromSquare.mutate()}
                  disabled={pullFromSquare.isPending}
                  variant="outline"
                  isActive={!!activeImportRun}
                  activeLabel={activeImportRun?.status === 'RUNNING' ? 'Importing...' : 'Queued'}
                  popoverContent={isSafeMode ? undefined : () => <ImportStatusPopover onNavigateToSyncQueue={handleNavigateToSyncQueue} />}
                >
                  <Package className={`h-4 w-4 mr-2 ${pullFromSquare.isPending ? 'animate-spin' : ''}`} />
                  Import from Square
                </SplitButton>
              ) : (
                <Button disabled variant="outline">
                  <Package className="h-4 w-4 mr-2" />
                  Import from Square
                </Button>
              )}
              
              {!isBusy ? (
                <SplitButton
                  onClick={handlePushAll}
                  disabled={pushToSquare.isPending}
                  variant="outline"
                  isActive={!!activeSyncRun}
                  activeLabel={activeSyncRun?.status === 'RUNNING' ? 'Syncing...' : 'Queued'}
                  popoverContent={isSafeMode ? undefined : () => <SyncStatusPopover localOnlyCount={localOnlyCount} onNavigateToSyncQueue={handleNavigateToSyncQueue} />}
                >
                  <Upload className={`h-4 w-4 mr-2 ${pushToSquare.isPending ? 'animate-spin' : ''}`} />
                  Push All Local
                </SplitButton>
              ) : (
                <Button disabled variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Push All Local
                </Button>
              )}
              
              <Button
                onClick={handleRefresh}
                disabled={isLoadingProducts}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingProducts ? 'animate-spin' : ''}`} />
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
            <TabsList className={`grid w-full ${isSafeMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <TabsTrigger value="catalog">
                Catalog ({products?.length || 0})
              </TabsTrigger>
              {!isSafeMode && (
                <TabsTrigger value="staging">
                  Staging
                </TabsTrigger>
              )}
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
                    <>
                      {/* Selection Toolbar */}
                      {selectedProductIds.length > 0 && (
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">
                              {selectedProductIds.length} product{selectedProductIds.length === 1 ? '' : 's'} selected
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handlePushSelected}
                                disabled={pushToSquare.isPending || selectedProducts.every(p => p.sync_state === 'SYNCED')}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Push Selected to Square
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={deleteProducts.isPending}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete Selected
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Selected Products</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {selectedProductIds.length} product{selectedProductIds.length === 1 ? '' : 's'}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={deleteProducts.isPending}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteSelected} disabled={deleteProducts.isPending}>
                                      {deleteProducts.isPending ? (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                          Deleting...
                                        </>
                                      ) : 'Delete'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleClearSelection}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear Selection
                          </Button>
                        </div>
                      )}
                      
                      {/* Data Table with stability key and busy state handling */}
                      {isBusy ? (
                        <div className="space-y-4">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-64 w-full" />
                        </div>
                      ) : displayedProducts.length >= 0 ? (
                        <ErrorBoundary fallback={<div className="p-4 text-center text-muted-foreground">Error loading table</div>}>
                          <DataTable 
                            key={`products-${displayedProducts.length}-${selectedProductIds.length}`}
                            columns={productColumns} 
                            data={displayedProducts}
                            searchKey="name"
                            rowSelection={rowSelection}
                            onRowSelectionChange={setRowSelection}
                            getRowId={(row) => row.id}
                          />
                        </ErrorBoundary>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {!isSafeMode && (
              <TabsContent value="staging" className="space-y-4">
                <Suspense fallback={
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                }>
                  <StagingTab />
                </Suspense>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </ErrorBoundary>
    </Layout>
  );
}
