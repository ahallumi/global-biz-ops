import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePlaceholderCleanup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mark products as placeholder based on criteria
  const markAsPlaceholder = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .update({ catalog_status: 'PLACEHOLDER' })
        .eq('catalog_status', 'ACTIVE')
        .or('retail_price_cents.is.null,retail_price_cents.eq.0')
        .or('default_cost_cents.is.null,default_cost_cents.eq.0')
        .in('origin', ['LOCAL', 'MERGED'])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staging-data'] });
      queryClient.invalidateQueries({ queryKey: ['staging-stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: `Marked ${Array.isArray(data) ? data.length : 0} products as placeholders`,
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

  // Convert eligible placeholders to candidates
  const convertPlaceholdersToCandidates = useMutation({
    mutationFn: async () => {
      // Get placeholders that are only referenced by draft intakes
      const { data: eligiblePlaceholders, error: queryError } = await supabase
        .from('products')
        .select(`
          id, name, upc, plu, size, unit_of_sale, weight_unit, default_cost_cents,
          product_intake_items!inner(
            id,
            intake:product_intakes!inner(status)
          )
        `)
        .eq('catalog_status', 'PLACEHOLDER')
        .eq('product_intake_items.intake.status', 'draft');

      if (queryError) throw queryError;

      if (!eligiblePlaceholders || eligiblePlaceholders.length === 0) {
        return { converted: 0 };
      }

      const conversions = [];

      for (const placeholder of eligiblePlaceholders) {
        // Create candidate
        const { data: candidate, error: candidateError } = await supabase
          .from('product_candidates')
          .insert({
            source: 'INTAKE_LEGACY',
            name: placeholder.name,
            upc: placeholder.upc,
            plu: placeholder.plu,
            size: placeholder.size,
            unit_of_sale: placeholder.unit_of_sale,
            weight_unit: placeholder.weight_unit,
            suggested_cost_cents: placeholder.default_cost_cents,
            status: 'PENDING'
          })
          .select()
          .single();

        if (candidateError) continue; // Skip this one

        // Archive the placeholder
        const { error: archiveError } = await supabase
          .from('products')
          .update({ catalog_status: 'ARCHIVED' })
          .eq('id', placeholder.id);

        if (archiveError) continue; // Skip this one

        conversions.push({ placeholder: placeholder.id, candidate: candidate.id });
      }

      return { converted: conversions.length, conversions };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['staging-data'] });
      queryClient.invalidateQueries({ queryKey: ['staging-stats'] });
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: `Converted ${result.converted} placeholders to candidates`,
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

  return {
    markAsPlaceholder,
    convertPlaceholdersToCandidates
  };
}