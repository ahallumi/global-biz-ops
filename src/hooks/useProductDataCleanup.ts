import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CleanupResult {
  barcode_updates: number;
  missing_prices_found: number;
  empty_barcodes_remaining: number;
  square_products_missing_prices: number;
  details: Array<{
    product_id: string;
    name: string;
    action: 'barcode_mirrored' | 'missing_price_detected';
    upc?: string;
    has_pos_link?: boolean;
  }>;
  recommendations: string[];
}

export function useProductDataCleanup() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (): Promise<CleanupResult> => {
      const { data, error } = await supabase.functions.invoke('cleanup-product-data');
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return {
        barcode_updates: data.summary.barcode_updates,
        missing_prices_found: data.summary.missing_prices_found,
        empty_barcodes_remaining: data.summary.empty_barcodes_remaining,
        square_products_missing_prices: data.summary.square_products_missing_prices,
        details: data.details,
        recommendations: data.recommendations
      };
    },
    onSuccess: (data) => {
      const updatesCount = data.barcode_updates;
      const missingPricesCount = data.missing_prices_found;
      
      toast({
        title: 'Product Data Cleanup Complete',
        description: `Updated ${updatesCount} barcode${updatesCount !== 1 ? 's' : ''}, found ${missingPricesCount} products with missing prices.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Cleanup Failed',
        description: `Failed to clean up product data: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}