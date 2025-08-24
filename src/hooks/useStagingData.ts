import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ProductCandidate = Database['public']['Tables']['product_candidates']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

// Extended type for candidates with relationships
type ExpandedCandidate = ProductCandidate & {
  intake?: { id: string; invoice_number: string | null; date_received: string } | null;
  supplier?: { id: string; name: string; code: string } | null;
  merged_product?: { id: string; name: string } | null;
};

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

export function useStagingData(enabled: boolean = true) {
  return useQuery({
    queryKey: ['staging-data'],
    enabled,
    queryFn: async () => {
      console.log('🔍 Fetching staging data...');
      
      // Fetch product candidates with error resilience
      let candidates: ExpandedCandidate[] = [];
      try {
        const { data, error: candidatesError } = await supabase
          .from('product_candidates')
          .select(`
            *,
            intake:product_intakes(id, invoice_number, date_received),
            supplier:suppliers(id, name, code),
            merged_product:products!product_candidates_merged_into_product_id_fkey(id, name)
          `)
          .order('created_at', { ascending: false });

        if (candidatesError) {
          console.error('❌ Candidates error:', candidatesError);
          throw candidatesError;
        }

        candidates = (data as ExpandedCandidate[]) || [];
        console.log('📋 Candidates loaded:', candidates.length);
      } catch (error) {
        console.error('❌ Failed to fetch candidates:', error);
        console.log('📋 Falling back to placeholders only');
        candidates = [];
      }

      // Fetch placeholder and archived products
      let placeholders: any[] = [];
      try {
        const { data, error: placeholdersError } = await supabase
          .from('products')
          .select('*')
          .in('catalog_status', ['PLACEHOLDER', 'ARCHIVED'])
          .order('created_at', { ascending: false });

        if (placeholdersError) throw placeholdersError;
        placeholders = data || [];
      } catch (error) {
        console.error('❌ Placeholders error:', error);
        placeholders = [];
      }

      console.log('📦 Placeholders loaded:', placeholders.length);

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

      console.log('🎯 Total staging items:', stagingItems.length);
      console.log('📊 Breakdown:', {
        candidates: candidates?.length || 0,
        placeholders: placeholders?.length || 0,
        total: stagingItems.length
      });

      return stagingItems;
    },
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });
}

export function useStagingStats(enabled: boolean = true) {
  return useQuery({
    queryKey: ['staging-stats'],
    enabled,
    queryFn: async () => {
      try {
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
      } catch (error) {
        console.warn('useStagingStats error:', error);
        return {
          pendingCandidates: 0,
          totalCandidates: 0,
          placeholders: 0,
          totalStaging: 0
        };
      }
    },
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });
}