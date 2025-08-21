import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type Intake = Database['public']['Tables']['product_intakes']['Row'];
type IntakeInsert = Database['public']['Tables']['product_intakes']['Insert'];
type IntakeUpdate = Database['public']['Tables']['product_intakes']['Update'];

export function useIntakes() {
  return useQuery({
    queryKey: ['intakes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_intakes')
        .select(`
          *,
          suppliers:supplier_id (
            name,
            code
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
}

export function useIntake(id: string) {
  return useQuery({
    queryKey: ['intake', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_intakes')
        .select(`
          *,
          suppliers:supplier_id (
            name,
            code,
            contact_name,
            contact_email,
            contact_phone
          ),
          product_intake_items (
            *,
            products:product_id (
              name,
              sku,
              upc,
              category,
              size
            )
          ),
          intake_files (
            id,
            kind,
            url,
            mime_type,
            byte_size,
            created_at
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

export function useCreateIntake() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (intake: Omit<IntakeInsert, 'submitted_by'>) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('product_intakes')
        .insert({
          ...intake,
          submitted_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
      toast({
        title: 'Success',
        description: 'Intake created successfully',
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

export function useUpdateIntake() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: IntakeUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('product_intakes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
      queryClient.invalidateQueries({ queryKey: ['intake', data.id] });
      toast({
        title: 'Success',
        description: 'Intake updated successfully',
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

export function useCreateIntakeItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Database['public']['Tables']['product_intake_items']['Insert']) => {
      const { data, error } = await supabase
        .from('product_intake_items')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intake', data.intake_id] });
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
      toast({
        title: 'Success',
        description: 'Product added to intake successfully',
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

export function useUpdateIntakeItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, intake_id, ...updates }: Database['public']['Tables']['product_intake_items']['Update'] & { id: string; intake_id: string }) => {
      const { data, error } = await supabase
        .from('product_intake_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intake', data.intake_id] });
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
      toast({
        title: 'Success',
        description: 'Product updated successfully',
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

export function useDeleteIntakeItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, intake_id }: { id: string; intake_id: string }) => {
      const { error } = await supabase
        .from('product_intake_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, intake_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intake', data.intake_id] });
      queryClient.invalidateQueries({ queryKey: ['intakes'] });
      toast({
        title: 'Success',
        description: 'Product removed from intake successfully',
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