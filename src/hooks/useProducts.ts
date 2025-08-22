
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export function useProducts(catalogStatus: string = 'ACTIVE') {
  return useQuery({
    queryKey: ['products', catalogStatus],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('catalog_status', catalogStatus)
        .order('name');
      
      if (error) throw error;
      return data as Product[];
    }
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
        .single();
      
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

export function useSearchProducts(query: string, catalogStatus: string = 'ACTIVE') {
  return useQuery({
    queryKey: ['products', 'search', query, catalogStatus],
    queryFn: async () => {
      if (!query.trim()) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('catalog_status', catalogStatus)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,upc.ilike.%${query}%,barcode.ilike.%${query}%`)
        .order('name')
        .limit(20);
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: query.trim().length > 0
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
