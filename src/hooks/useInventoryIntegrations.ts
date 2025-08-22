import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInventoryIntegrations() {
  return useQuery({
    queryKey: ['inventory-integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_integrations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });
}

export function useInventoryIntegration(id: string) {
  return useQuery({
    queryKey: ['inventory-integration', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_integrations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}

export function useUpdateInventoryIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('inventory_integrations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-integrations'] });
      toast({
        title: 'Integration Updated',
        description: 'Settings have been saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}

export function useCreateInventoryIntegration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (integration: any) => {
      const { data, error } = await supabase
        .from('inventory_integrations')
        .insert(integration)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-integrations'] });
      toast({
        title: 'Integration Created',
        description: 'Square integration has been set up',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });
}

export function useTestConnection() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      const { data, error } = await supabase.functions.invoke('square-test-connection', {
        body: { integrationId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast({
          title: 'Connection Successful',
          description: `Connected to ${data.locations?.length || 0} Square location(s)`,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: data.error || 'Unknown error occurred',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}

export function useImportProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ integrationId, mode = 'FULL' }: { integrationId: string; mode?: 'FULL' | 'DELTA' }) => {
      const { data, error } = await supabase.functions.invoke('square-import-products', {
        body: { integrationId, mode }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] });
      toast({
        title: 'Import Started',
        description: `Processing ${data.processed_count || 0} products from Square`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}