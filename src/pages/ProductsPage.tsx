import { useState } from 'react';
import { useProducts, useSearchProducts } from '@/hooks/useProducts';
import { useProductCandidates } from '@/hooks/useProductCandidates';
import { useProductSyncRuns, useProductImportRuns, usePushProductsToSquare, usePullProductsFromSquare } from '@/hooks/useProductSync';
import { useInventoryIntegrations } from '@/hooks/useInventoryIntegrations';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Database } from '@/integrations/supabase/types';
import { Search, RefreshCw, Package, Upload, Download, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateActions } from '@/components/products/CandidateActions';

type Product = Database['public']['Tables']['products']['Row'];

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('catalog');
  
  // Product hooks - now filtered by catalog status
  const { data: products, isLoading: isLoadingProducts, refetch: refetchProducts } = useProducts('ACTIVE');
  const { data: placeholderProducts, isLoading: isLoadingPlaceholders } = useProducts('PLACEHOLDER');
  const { data: searchResults, isLoading: isSearching } = useSearchProducts(searchQuery, 'ACTIVE');
  
  // Candidate hooks
  const { data: candidates, isLoading: isLoadingCandidates, refetch: refetchCandidates } = useProductCandidates();
  
  // Sync hooks
  const { data: syncRuns, isLoading: isLoadingSyncRuns } = useProductSyncRuns();
  const { data: importRuns, isLoading: isLoadingImportRuns } = useProductImportRuns();
  const pushToSquare = usePushProductsToSquare();
  const pullFromSquare = usePullProductsFromSquare();
  
  // Integration
  const { data: integrations } = useInventoryIntegrations();

  const displayedProducts = searchQuery.trim() ? searchResults || [] : products || [];

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

  // Candidate columns
  const candidateColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue('source')}</Badge>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('name') || 'Unnamed'}</div>
      ),
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
      accessorKey: 'intake',
      header: 'Intake',
      cell: ({ row }) => {
        const intake = row.getValue('intake') as any;
        return intake ? (
          <div className="text-sm">
            <div>{intake.invoice_number}</div>
            <div className="text-muted-foreground">{new Date(intake.date_received).toLocaleDateString()}</div>
          </div>
        ) : 'N/A';
      },
    },
    {
      accessorKey: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => {
        const supplier = row.getValue('supplier') as any;
        return supplier ? supplier.name : 'N/A';
      },
    },
    {
      accessorKey: 'suggested_cost_cents',
      header: 'Suggested Cost',
      cell: ({ row }) => {
        const cents = row.getValue('suggested_cost_cents') as number;
        return cents ? `$${(cents / 100).toFixed(2)}` : 'N/A';
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const getVariant = (status: string) => {
          switch (status) {
            case 'APPROVED': return 'default';
            case 'REJECTED': return 'destructive';
            case 'MERGED': return 'secondary';
            default: return 'outline';
          }
        };
        return <Badge variant={getVariant(status)}>{status}</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const candidate = row.original;
        return <CandidateActions candidate={candidate} />;
      },
    },
  ];

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

  const handleRefresh = () => {
    if (activeTab === 'catalog') {
      refetchProducts();
    } else if (activeTab === 'candidates') {
      refetchCandidates();
    }
  };

  const handlePushAll = () => {
    const localOnlyProducts = products?.filter(p => p.sync_state === 'LOCAL_ONLY').map(p => p.id) || [];
    if (localOnlyProducts.length > 0) {
      pushToSquare.mutate(localOnlyProducts);
    }
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
            <Button
              onClick={() => pullFromSquare.mutate()}
              disabled={pullFromSquare.isPending}
              variant="outline"
            >
              <Download className={`h-4 w-4 mr-2 ${pullFromSquare.isPending ? 'animate-spin' : ''}`} />
              Import from Square
            </Button>
            <Button
              onClick={handlePushAll}
              disabled={pushToSquare.isPending || !products?.some(p => p.sync_state === 'LOCAL_ONLY')}
              variant="outline"
            >
              <Upload className={`h-4 w-4 mr-2 ${pushToSquare.isPending ? 'animate-spin' : ''}`} />
              Push All Local
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={isLoadingProducts || isLoadingCandidates}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(isLoadingProducts || isLoadingCandidates) ? 'animate-spin' : ''}`} />
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="catalog">
              Catalog ({products?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="candidates">
              Candidates ({candidates?.filter(c => c.status === 'PENDING').length || 0})
            </TabsTrigger>
            <TabsTrigger value="placeholders">
              Hidden ({placeholderProducts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="sync">
              Sync Queue
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

          <TabsContent value="candidates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Product Candidates</CardTitle>
                <CardDescription>
                  Staged items discovered during intake. Approve or map them to add to the live catalog.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCandidates ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <DataTable 
                    columns={candidateColumns} 
                    data={candidates || []}
                    searchKey="name"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="placeholders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Hidden Products</CardTitle>
                <CardDescription>
                  Placeholder and archived products that don't appear in the live catalog.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPlaceholders ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <DataTable 
                    columns={productColumns} 
                    data={placeholderProducts || []}
                    searchKey="name"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
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
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
