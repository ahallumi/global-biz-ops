import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackupResult {
  success: boolean;
  backup: {
    timestamp: string;
    backed_up_by: string;
    data: Record<string, any>;
  };
  summary: {
    total_records: number;
    tables_backed_up: number;
    timestamp: string;
  };
}

interface ResetResult {
  success: boolean;
  summary: {
    total_deleted: number;
    tables_processed: number;
    errors_count: number;
    include_history: boolean;
    deleted_counts: Record<string, number>;
    errors: string[];
  };
}

export function useProductCatalogBackup() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (): Promise<BackupResult> => {
      const { data, error } = await supabase.functions.invoke('product-catalog-backup');
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Backup failed');
      
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Backup Complete',
        description: `Successfully backed up ${data.summary.total_records} records from ${data.summary.tables_backed_up} tables.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Backup Failed',
        description: `Failed to backup catalog: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}

export function useProductCatalogReset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ includeHistory = false }: { includeHistory?: boolean } = {}): Promise<ResetResult> => {
      const { data, error } = await supabase.functions.invoke('reset-product-catalog', {
        body: { include_history: includeHistory }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Reset failed');
      
      return data;
    },
    onSuccess: (data) => {
      // Invalidate all product-related queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['product-intakes'] });
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] });
      queryClient.invalidateQueries({ queryKey: ['product-sync-runs'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      
      // Clear any cached data
      queryClient.removeQueries({ queryKey: ['products'] });
      queryClient.removeQueries({ queryKey: ['product-candidates'] });
      
      const { total_deleted, errors_count } = data.summary;
      const errorSuffix = errors_count > 0 ? ` (${errors_count} errors)` : '';
      
      toast({
        title: 'Catalog Reset Complete',
        description: `Successfully deleted ${total_deleted} records${errorSuffix}. Ready for fresh import.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Reset Failed',
        description: `Failed to reset catalog: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}