
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useImportWatchdog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('import-watchdog');
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Force refresh all import-related queries to clear stale data
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] });
      queryClient.invalidateQueries({ queryKey: ['active-import-run'] });
      queryClient.invalidateQueries({ queryKey: ['running-import-run'] });
      queryClient.invalidateQueries({ queryKey: ['latest-import-run'] });
      queryClient.invalidateQueries({ queryKey: ['active-imports'] });
      
      // Force remove any stale data from cache
      queryClient.removeQueries({ queryKey: ['active-import-run'] });
      queryClient.removeQueries({ queryKey: ['running-import-run'] });
      
      const cleanedCount = data?.cleaned_count || 0;
      if (cleanedCount > 0) {
        toast({
          title: 'Stale Imports Cleared',
          description: `${cleanedCount} stale import runs have been cleaned up.`,
        });
      } else {
        toast({
          title: 'No Stale Imports',
          description: 'No stale import runs were found to clean up.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Watchdog Failed',
        description: `Failed to run import watchdog: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}
