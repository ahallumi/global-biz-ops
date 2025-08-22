import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type ProductSyncRun = Database['public']['Tables']['product_sync_runs']['Row'];

export function useProductSyncRuns() {
  return useQuery({
    queryKey: ['product-sync-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_sync_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as ProductSyncRun[];
    }
  });
}

export function useProductImportRuns() {
  return useQuery({
    queryKey: ['product-import-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_import_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });
}

export function usePushProductsToSquare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (productIds?: string[]) => {
      const { data, error } = await supabase.functions.invoke('square-push-products', {
        body: { productIds }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-sync-runs'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: `Push to Square initiated. ${data?.processed_count || 0} products queued.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to push products to Square: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}

export function usePullProductsFromSquare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('square-import-products', {
        body: {}
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: `Import from Square initiated. Check sync queue for progress.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to import from Square: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}