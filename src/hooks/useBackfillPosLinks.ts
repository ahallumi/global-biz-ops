import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackfillResult {
  matched_count: number;
  details: Array<{
    product_id: string;
    pos_item_id: string;
    pos_variation_id: string | null;
    match_method: 'UPC' | 'SKU';
  }>;
}

export function useBackfillPosLinks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (integrationId: string): Promise<BackfillResult> => {
      const { data, error } = await supabase.functions.invoke('backfill-pos-links', {
        body: { integrationId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Refresh related queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-pos-links'] });
      queryClient.invalidateQueries({ queryKey: ['find-duplicate-products'] });
      
      toast({
        title: 'Backfill Complete',
        description: `Successfully backfilled ${data.matched_count} POS links using existing UPC/SKU data.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Backfill Failed',
        description: `Failed to backfill POS links: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}