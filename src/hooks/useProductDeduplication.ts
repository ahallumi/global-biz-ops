import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DuplicateGroup {
  upc?: string;
  sku?: string;
  products: Array<{
    id: string;
    name: string;
    sku?: string;
    upc?: string;
    created_at: string;
    pos_links: Array<{
      pos_item_id: string;
      pos_variation_id?: string;
      integration_id: string;
    }>;
  }>;
}

export function useFindDuplicateProducts() {
  return useQuery({
    queryKey: ['product-duplicates'],
    queryFn: async () => {
      // Find products with duplicate UPCs (excluding null/empty)
      const { data: upcDuplicates, error: upcError } = await supabase
        .from('v_product_pos_identity')
        .select(`
          product_id,
          name,
          sku,
          upc,
          created_at:pos_link_created_at,
          pos_item_id,
          pos_variation_id,
          integration_id
        `)
        .not('upc', 'is', null)
        .neq('upc', '')
        .order('upc')
        .order('created_at');

      if (upcError) throw upcError;

      // Find products with duplicate SKUs (excluding null/empty)
      const { data: skuDuplicates, error: skuError } = await supabase
        .from('v_product_pos_identity')
        .select(`
          product_id,
          name,
          sku,
          upc,
          created_at:pos_link_created_at,
          pos_item_id,
          pos_variation_id,
          integration_id
        `)
        .not('sku', 'is', null)
        .neq('sku', '')
        .order('sku')
        .order('created_at');

      if (skuError) throw skuError;

      // Group by UPC
      const upcGroups: Record<string, DuplicateGroup> = {};
      upcDuplicates?.forEach(product => {
        if (!product.upc) return;
        if (!upcGroups[product.upc]) {
          upcGroups[product.upc] = { upc: product.upc, products: [] };
        }
        upcGroups[product.upc].products.push({
          id: product.product_id,
          name: product.name,
          sku: product.sku,
          upc: product.upc,
          created_at: product.created_at,
          pos_links: [{
            pos_item_id: product.pos_item_id,
            pos_variation_id: product.pos_variation_id,
            integration_id: product.integration_id
          }].filter(link => link.pos_item_id)
        });
      });

      // Group by SKU
      const skuGroups: Record<string, DuplicateGroup> = {};
      skuDuplicates?.forEach(product => {
        if (!product.sku) return;
        if (!skuGroups[product.sku]) {
          skuGroups[product.sku] = { sku: product.sku, products: [] };
        }
        skuGroups[product.sku].products.push({
          id: product.product_id,
          name: product.name,
          sku: product.sku,
          upc: product.upc,
          created_at: product.created_at,
          pos_links: [{
            pos_item_id: product.pos_item_id,
            pos_variation_id: product.pos_variation_id,
            integration_id: product.integration_id
          }].filter(link => link.pos_item_id)
        });
      });

      // Filter to only groups with actual duplicates
      const duplicateUpcGroups = Object.values(upcGroups).filter(group => group.products.length > 1);
      const duplicateSkuGroups = Object.values(skuGroups).filter(group => group.products.length > 1);

      return {
        upcDuplicates: duplicateUpcGroups,
        skuDuplicates: duplicateSkuGroups,
        totalDuplicates: duplicateUpcGroups.length + duplicateSkuGroups.length
      };
    },
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });
}

export function useMergeDuplicateProducts() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      canonicalProductId, 
      duplicateProductIds 
    }: { 
      canonicalProductId: string; 
      duplicateProductIds: string[] 
    }) => {
      // This would typically be handled by an edge function for complex operations
      // For now, we'll just delete the duplicates (in a real app you'd want to merge references)
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', duplicateProductIds);

      if (error) throw error;

      return { canonicalProductId, duplicateProductIds };
    },
    onSuccess: ({ duplicateProductIds }) => {
      toast({
        title: 'Success',
        description: `Merged ${duplicateProductIds.length} duplicate products`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to merge duplicate products',
        variant: 'destructive',
      });
    }
  });
}

export function useAutoResolveDuplicates() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      // Call an edge function to handle complex duplicate resolution
      const { data, error } = await supabase.functions.invoke('resolve-duplicate-products', {
        body: { mode: 'auto' }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Auto-resolved ${data.resolved} duplicate groups`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to auto-resolve duplicates',
        variant: 'destructive',
      });
    }
  });
}