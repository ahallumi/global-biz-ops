
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];
type CatalogStatus = Database['public']['Enums']['catalog_status'];

export function useProducts(catalogStatus: CatalogStatus = 'ACTIVE') {
  return useQuery({
    queryKey: ['products', catalogStatus],
    queryFn: async () => {
      try {
        if (catalogStatus === 'ACTIVE') {
          // Use secure catalog view for ACTIVE products only
          const { data, error } = await supabase
            .from('v_products_catalog' as any)
            .select('*')
            .order('name');
          
          if (error) throw error;
          return data as unknown as Product[];
        } else {
          // Use regular products table for other statuses
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('catalog_status', catalogStatus)
            .order('name');
          
          if (error) throw error;
          return data as Product[];
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (/load failed|failed to fetch|network/i.test(msg)) {
          console.warn('Products query suppressed network error:', msg);
          return [] as Product[];
        }
        throw err;
      }
    },
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (product: ProductInsert) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: 'Product created successfully',
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
}

export function useSearchProducts(query: string, catalogStatus: CatalogStatus = 'ACTIVE') {
  return useQuery({
    queryKey: ['products', 'search', query, catalogStatus],
    queryFn: async () => {
      try {
        if (!query.trim()) return [];
        
        if (catalogStatus === 'ACTIVE') {
          // Use secure catalog view for ACTIVE products only
          const { data, error } = await supabase
            .from('v_products_catalog' as any)
            .select('*')
            .or(`name.ilike.%${query}%,sku.ilike.%${query}%,upc.ilike.%${query}%,barcode.ilike.%${query}%`)
            .order('name')
            .limit(20);
          
          if (error) throw error;
          return data as unknown as Product[];
        } else {
          // Use regular products table for other statuses
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('catalog_status', catalogStatus)
            .or(`name.ilike.%${query}%,sku.ilike.%${query}%,upc.ilike.%${query}%,barcode.ilike.%${query}%`)
            .order('name')
            .limit(20);
          
          if (error) throw error;
          return data as Product[];
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (/load failed|failed to fetch|network/i.test(msg)) {
          console.warn('Product search suppressed network error:', msg);
          return [] as Product[];
        }
        throw err;
      }
    },
    enabled: query.trim().length > 0,
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });
}

export function useFindPlaceholderProduct() {
  return useMutation({
    mutationFn: async ({ upc, plu, name }: { upc?: string; plu?: string; name?: string }) => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('catalog_status', 'PLACEHOLDER');

      if (upc) {
        query = query.eq('upc', upc);
      } else if (plu) {
        query = query.eq('plu', plu);
      } else if (name) {
        query = query.ilike('name', `%${name}%`);
      } else {
        return null;
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });
}

export function useDeleteProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', productIds);
      
      if (error) throw error;
      return productIds;
    },
    onSuccess: (productIds) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: `${productIds.length} product${productIds.length === 1 ? '' : 's'} deleted successfully`,
      });
    },
    onError: (error: any) => {
      const msg = (error?.code === '23503' || /foreign key/i.test(error?.message || ''))
        ? 'Some products could not be deleted because they are referenced by other records.'
        : (error?.message || 'Failed to delete products');
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    }
  });
}
