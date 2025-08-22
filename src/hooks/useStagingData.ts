import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ProductCandidate = Database['public']['Tables']['product_candidates']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

export type StagingItem = {
  id: string;
  type: 'CANDIDATE' | 'PLACEHOLDER';
  source: string;
  status: string;
  name: string;
  upc?: string | null;
  plu?: string | null;
  size?: string | null;
  unit_of_sale?: string | null;
  suggested_cost_cents?: number | null;
  created_at: string;
  intake?: any;
  supplier?: any;
  merged_product?: any;
  // Original data for actions
  original_data: any; // Use any for now to simplify type handling
};

export function useStagingData() {
  return useQuery({
    queryKey: ['staging-data'],
    queryFn: async () => {
      // Fetch product candidates
      const { data: candidates, error: candidatesError } = await supabase
        .from('product_candidates')
        .select(`
          *,
          intake:product_intakes(id, invoice_number, date_received),
          supplier:suppliers(id, name, code),
          merged_product:products(id, name)
        `)
        .order('created_at', { ascending: false });

      if (candidatesError) throw candidatesError;

      // Fetch placeholder and archived products
      const { data: placeholders, error: placeholdersError } = await supabase
        .from('products')
        .select('*')
        .in('catalog_status', ['PLACEHOLDER', 'ARCHIVED'])
        .order('created_at', { ascending: false });

      if (placeholdersError) throw placeholdersError;

      // Combine and transform data
      const stagingItems: StagingItem[] = [
        // Product candidates
        ...((candidates || []).map((candidate) => ({
          id: candidate.id,
          type: 'CANDIDATE' as const,
          source: candidate.source || 'INTAKE',
          status: candidate.status || 'PENDING',
          name: candidate.name || 'Unnamed',
          upc: candidate.upc,
          plu: candidate.plu,
          size: candidate.size,
          unit_of_sale: candidate.unit_of_sale,
          suggested_cost_cents: candidate.suggested_cost_cents,
          created_at: candidate.created_at || '',
          intake: candidate.intake,
          supplier: candidate.supplier,
          merged_product: candidate.merged_product,
          original_data: candidate
        }))),
        
        // Legacy placeholders
        ...((placeholders || []).map((product) => ({
          id: product.id,
          type: 'PLACEHOLDER' as const,
          source: 'LEGACY_PLACEHOLDER',
          status: product.catalog_status || 'PLACEHOLDER',
          name: product.name || 'Unnamed',
          upc: product.upc,
          plu: product.plu,
          size: product.size,
          unit_of_sale: product.unit_of_sale,
          suggested_cost_cents: product.default_cost_cents,
          created_at: product.created_at || '',
          intake: null,
          supplier: null,
          merged_product: null,
          original_data: product
        })))
      ];

      return stagingItems;
    }
  });
}

export function useStagingStats() {
  return useQuery({
    queryKey: ['staging-stats'],
    queryFn: async () => {
      // Get candidate counts
      const { count: pendingCandidatesCount } = await supabase
        .from('product_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      const { count: totalCandidatesCount } = await supabase
        .from('product_candidates')
        .select('id', { count: 'exact', head: true });

      // Get placeholder counts  
      const { count: placeholdersCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .in('catalog_status', ['PLACEHOLDER', 'ARCHIVED']);

      return {
        pendingCandidates: pendingCandidatesCount || 0,
        totalCandidates: totalCandidatesCount || 0,
        placeholders: placeholdersCount || 0,
        totalStaging: (totalCandidatesCount || 0) + (placeholdersCount || 0)
      };
    }
  });
}