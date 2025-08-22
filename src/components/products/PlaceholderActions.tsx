import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSearchProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { 
  MoreHorizontal, 
  ArrowUp, 
  RefreshCw, 
  Link, 
  Archive 
} from 'lucide-react';

type Product = Database['public']['Tables']['products']['Row'];

interface PlaceholderActionsProps {
  product: any; // Make it flexible to accept staging item data
}

export function PlaceholderActions({ product }: PlaceholderActionsProps) {
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: searchResults } = useSearchProducts(productSearch, 'ACTIVE');

  // Convert to Candidate mutation
  const convertToCandidate = useMutation({
    mutationFn: async () => {
      // Create candidate from placeholder
      const { data: candidate, error: candidateError } = await supabase
        .from('product_candidates')
        .insert({
          source: 'INTAKE_LEGACY',
          name: product.name,
          upc: product.upc,
          plu: product.plu,
          size: product.size,
          unit_of_sale: product.unit_of_sale,
          weight_unit: product.weight_unit,
          suggested_cost_cents: product.default_cost_cents,
          status: 'PENDING'
        })
        .select()
        .single();

      if (candidateError) throw candidateError;

      // Archive the original placeholder
      const { error: archiveError } = await supabase
        .from('products')
        .update({ catalog_status: 'ARCHIVED' })
        .eq('id', product.id);

      if (archiveError) throw archiveError;

      return { candidate, archivedProduct: product };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging-data'] });
      queryClient.invalidateQueries({ queryKey: ['staging-stats'] });
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: 'Placeholder converted to candidate successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Promote to Active mutation
  const promoteToActive = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .update({
          catalog_status: 'ACTIVE',
          origin: 'LOCAL',
          sync_state: 'LOCAL_ONLY',
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging-data'] });
      queryClient.invalidateQueries({ queryKey: ['staging-stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: 'Product promoted to active catalog',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Map to Existing mutation
  const mapToExisting = useMutation({
    mutationFn: async (targetProductId: string) => {
      // TODO: Update intake items to reference the target product instead
      // This would require checking for draft intake items that reference this placeholder
      
      // Archive the placeholder
      const { error } = await supabase
        .from('products')
        .update({ catalog_status: 'ARCHIVED' })
        .eq('id', product.id);

      if (error) throw error;
      return { targetProductId, archivedProductId: product.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging-data'] });
      queryClient.invalidateQueries({ queryKey: ['staging-stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowMapDialog(false);
      toast({
        title: 'Success',
        description: 'Placeholder mapped to existing product and archived',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Archive mutation
  const archiveProduct = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .update({ catalog_status: 'ARCHIVED' })
        .eq('id', product.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging-data'] });
      queryClient.invalidateQueries({ queryKey: ['staging-stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: 'Product archived successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleMapToProduct = (targetProductId: string) => {
    mapToExisting.mutate(targetProductId);
  };

  // Don't show actions for already archived products
  if (product.catalog_status === 'ARCHIVED') {
    return (
      <div className="text-sm text-muted-foreground">
        Archived
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => convertToCandidate.mutate()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Convert to Candidate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => promoteToActive.mutate()}>
            <ArrowUp className="h-4 w-4 mr-2" />
            Promote to Active
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowMapDialog(true)}>
            <Link className="h-4 w-4 mr-2" />
            Map to Existing
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => archiveProduct.mutate()}
            className="text-muted-foreground"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Map to Existing Dialog */}
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Map to Existing Product</DialogTitle>
            <DialogDescription>
              Search for and select an existing active product to merge this placeholder with.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Search active products by name, UPC, or SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            
            {searchResults && searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {searchResults.map((targetProduct) => (
                  <div
                    key={targetProduct.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleMapToProduct(targetProduct.id)}
                  >
                    <div>
                      <div className="font-medium">{targetProduct.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {targetProduct.upc && `UPC: ${targetProduct.upc}`}
                        {targetProduct.brand && ` • ${targetProduct.brand}`}
                      </div>
                    </div>
                    <Link className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
            
            {productSearch.trim() && (!searchResults || searchResults.length === 0) && (
              <div className="text-center py-4 text-muted-foreground">
                No active products found matching "{productSearch}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}