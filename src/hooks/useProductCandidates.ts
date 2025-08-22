import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type ProductCandidate = Database['public']['Tables']['product_candidates']['Row'];
type ProductCandidateInsert = Database['public']['Tables']['product_candidates']['Insert'];
type ProductCandidateUpdate = Database['public']['Tables']['product_candidates']['Update'];

export function useProductCandidates() {
  return useQuery({
    queryKey: ['product-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_candidates')
        .select(`
          *,
          intake:product_intakes(id, invoice_number, date_received),
          supplier:suppliers(id, name, code),
          merged_product:products(id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
}

export function useProductCandidate(id: string) {
  return useQuery({
    queryKey: ['product-candidate', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_candidates')
        .select(`
          *,
          intake:product_intakes(id, invoice_number, date_received),
          supplier:suppliers(id, name, code),
          merged_product:products(id, name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

export function useCreateProductCandidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (candidate: ProductCandidateInsert) => {
      const { data, error } = await supabase
        .from('product_candidates')
        .insert(candidate)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      toast({
        title: 'Success',
        description: 'Product candidate created successfully',
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

export function useUpdateProductCandidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & ProductCandidateUpdate) => {
      const { data, error } = await supabase
        .from('product_candidates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      toast({
        title: 'Success',
        description: 'Product candidate updated successfully',
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

export function useApproveCandidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ candidateId, productData }: { 
      candidateId: string;
      productData: Database['public']['Tables']['products']['Insert'];
    }) => {
      // Create the product first
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          ...productData,
          origin: 'LOCAL',
          sync_state: 'LOCAL_ONLY'
        })
        .select()
        .single();

      if (productError) throw productError;

      // Update candidate status to APPROVED and link to the new product
      const { error: candidateError } = await supabase
        .from('product_candidates')
        .update({
          status: 'APPROVED',
          merged_into_product_id: product.id
        })
        .eq('id', candidateId);

      if (candidateError) throw candidateError;

      return { product, candidateId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: 'Product candidate approved and added to catalog',
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

export function useMapCandidateToProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ candidateId, productId }: { candidateId: string; productId: string }) => {
      const { data, error } = await supabase
        .from('product_candidates')
        .update({
          status: 'MERGED',
          merged_into_product_id: productId
        })
        .eq('id', candidateId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      toast({
        title: 'Success',
        description: 'Product candidate mapped to existing product',
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

export function useRejectCandidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { data, error } = await supabase
        .from('product_candidates')
        .update({ status: 'REJECTED' })
        .eq('id', candidateId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      toast({
        title: 'Success',
        description: 'Product candidate rejected',
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