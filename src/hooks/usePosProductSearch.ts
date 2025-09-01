import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  upc: string | null;
  pos_item_id?: string;
  pos_variation_id?: string | null;
}

export function usePosProductSearch() {
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const searchByPosId = useCallback(async (query: string, integrationId?: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Search for products by POS Item ID or Variation ID
      let searchQuery = supabase
        .from('v_product_pos_identity')
        .select('product_id, name, sku, upc, pos_item_id, pos_variation_id')
        .or(`pos_item_id.ilike.%${query}%,pos_variation_id.ilike.%${query}%`);

      if (integrationId) {
        searchQuery = searchQuery.eq('integration_id', integrationId);
      }

      const { data, error } = await searchQuery
        .limit(20)
        .order('name');

      if (error) {
        console.error('Error searching by POS ID:', error);
        setResults([]);
        return;
      }

      // Transform the data to match our Product interface
      const transformedResults: Product[] = (data || []).map(item => ({
        id: item.product_id || '',
        name: item.name || '',
        sku: item.sku,
        upc: item.upc,
        pos_item_id: item.pos_item_id || undefined,
        pos_variation_id: item.pos_variation_id
      }));

      setResults(transformedResults);
    } catch (error) {
      console.error('Error searching by POS ID:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    results,
    loading,
    searchByPosId,
    clearResults: () => setResults([])
  };
}