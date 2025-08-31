import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInventoryIntegrations() {
  return useQuery({
    queryKey: ['inventory-integrations'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('inventory_integrations')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('useInventoryIntegrations error:', err);
        return [];
      }
    },
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
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
      try {
        const { data, error } = await supabase
          .from('product_import_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(10);
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('useProductImportRuns (inventory) error:', err);
        return [];
      }
    },
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
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
    mutationFn: async ({ integrationId, mode = 'START' }: { integrationId: string; mode?: 'START' | 'RESUME' }) => {
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
      let description = error.message;
      
      // Handle specific error cases with friendlier messages
      if (error.message.includes('Import already in progress') || error.message.includes('409')) {
        description = 'An import is already in progress. Please wait for it to complete or use the Unstick button if it appears stale.';
      } else if (error.message.includes('Wrong key or corrupt data')) {
        description = 'Square credentials need to be re-saved. Please check your integration settings.';
      }
      
      toast({
        title: 'Import Error',
        description,
        variant: 'destructive',
      });
    }
  });
}

export function useCredentialStatus(integrationId?: string) {
  return useQuery({
    queryKey: ['credential-status', integrationId],
    queryFn: async () => {
      if (!integrationId) return { hasCredentials: false };
      
      const { data, error } = await supabase
        .from('integration_credentials')
        .select('id, created_at, updated_at')
        .eq('integration_id', integrationId)
        .maybeSingle();
      
      if (error) throw error;
      return {
        hasCredentials: !!data,
        lastUpdated: data?.updated_at
      };
    },
    enabled: !!integrationId
  });
}

export function useSaveCredentials() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ integrationId, accessToken, provider, environment }: { 
      integrationId: string; 
      accessToken: string;
      provider: string;
      environment: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('inventory-save-credentials', {
        body: { integrationId, accessToken, provider, environment }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credential-status'] });
      toast({
        title: 'Credentials Saved',
        description: 'API credentials have been securely stored',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Save Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
}
