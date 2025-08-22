import { useState } from 'react';
import { useProducts, useSearchProducts } from '@/hooks/useProducts';
import { useInventoryIntegrations } from '@/hooks/useInventoryIntegrations';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Database } from '@/integrations/supabase/types';
import { Search, RefreshCw, Package, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type Product = Database['public']['Tables']['products']['Row'];

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: products, isLoading: isLoadingProducts, refetch: refetchProducts } = useProducts();
  const { data: searchResults, isLoading: isSearching } = useSearchProducts(searchQuery);
  const { data: integrations } = useInventoryIntegrations();

  const displayedProducts = searchQuery.trim() ? searchResults || [] : products || [];

  const columns: ColumnDef<Product>[] = [
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
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.getValue('sku') || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'upc',
      header: 'UPC',
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.getValue('upc') || 'N/A'}</div>
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
      header: 'Price',
      cell: ({ row }) => {
        const cents = row.getValue('retail_price_cents') as number;
        return cents ? `$${(cents / 100).toFixed(2)}` : 'N/A';
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <div className="text-sm">{row.getValue('category') || 'Uncategorized'}</div>
      ),
    },
    {
      id: 'actions',
      header: 'POS Link',
      cell: ({ row }) => {
        // This would show if product is linked to POS system
        // For now showing a placeholder
        return (
          <Badge variant="secondary" className="gap-1">
            <ExternalLink className="h-3 w-3" />
            Square
          </Badge>
        );
      },
    },
  ];

  const handleRefresh = () => {
    refetchProducts();
  };

  const activeIntegration = integrations?.find(i => i.provider === 'SQUARE');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage your product catalog and POS integrations
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                {activeIntegration.last_success_at && (
                  <span className="text-sm text-muted-foreground">
                    Last sync: {new Date(activeIntegration.last_success_at).toLocaleString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
            <CardTitle>Products ({displayedProducts.length})</CardTitle>
            <CardDescription>
              {searchQuery.trim() 
                ? `Search results for "${searchQuery}"`
                : 'All products in your catalog'
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
                columns={columns} 
                data={displayedProducts}
                searchKey="name"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}