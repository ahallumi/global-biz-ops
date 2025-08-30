import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type ProductSyncRun = Database['public']['Tables']['product_sync_runs']['Row'];

export function useProductSyncRuns() {
  return useQuery({
    queryKey: ['product-sync-runs'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('product_sync_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        return (data as ProductSyncRun[]) || [];
      } catch (err) {
        console.warn('useProductSyncRuns error:', err);
        return [] as ProductSyncRun[];
      }
    },
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
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
          .limit(20);
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('useProductImportRuns error:', err);
        return [];
      }
    },
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });
}

export function usePushProductsToSquare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (productIds?: string[]) => {
      const { data, error } = await supabase.functions.invoke('square-push-products', {
        body: { productIds }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-sync-runs'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: `Push to Square initiated. ${data?.processed_count || 0} products queued.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to push products to Square: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}

export function usePullProductsFromSquare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      // Fetch Square integration ID
      const { data: integrations, error: integrationError } = await supabase
        .from('inventory_integrations')
        .select('id')
        .eq('provider', 'SQUARE')
        .limit(1)
        .maybeSingle();

      if (integrationError) {
        throw new Error(`Failed to fetch integration: ${integrationError.message}`);
      }

      if (!integrations) {
        throw new Error('No Square integration found. Please configure Square integration first.');
      }

      const { data, error } = await supabase.functions.invoke('square-import-products', {
        body: { integrationId: integrations.id }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Success',
        description: `Import from Square initiated. Check sync queue for progress.`,
      });
    },
    onError: (error: any) => {
      let errorMessage = error.message;
      
      // Handle specific error cases with better messaging
      if (error.message?.includes('Import already in progress')) {
        errorMessage = 'An import is already running. Use "Abort Active Import" to cancel it first.';
      } else if (error.message?.includes('No Square integration')) {
        errorMessage = 'No Square integration configured. Please set up Square integration first.';
      }
      
      toast({
        title: 'Import Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });
}

// Hook to abort an active import
export function useAbortImport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke('import-abort', {
        body: { runId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] });
      toast({
        title: 'Import Aborted',
        description: 'The active import has been cancelled.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Abort Failed',
        description: `Failed to abort import: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
}

// Active sync detection hooks
export function useActiveSyncRun() {
  return useQuery({
    queryKey: ['active-sync-run'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('product_sync_runs')
          .select('*')
          .is('finished_at', null)
          .in('status', ['RUNNING', 'PENDING'])
          .eq('direction', 'OUT')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('Active sync run polling error:', error);
          return null;
        }
        return (data as ProductSyncRun | null) ?? null;
      } catch (err) {
        console.warn('Active sync run polling exception:', err);
        return null;
      }
    },
    refetchInterval: 2000,
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 5000,
  });
}

export function useActiveImportRun() {
  return useQuery({
    queryKey: ['active-import-run'],
    queryFn: async () => {
      try {
        // Get the last few runs to make smart selection
        const { data: runs, error } = await supabase
          .from('product_import_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(5);

        if (error) {
          console.warn('Active import run polling error:', error);
          return null;
        }

        if (!runs || runs.length === 0) {
          return null;
        }

        // 1. First priority: truly active runs
        const activeRun = runs.find(r => 
          (r.status === 'RUNNING' || r.status === 'PENDING' || r.status === 'PARTIAL') && !r.finished_at
        );
        
        if (activeRun) {
          return activeRun;
        }

        // 2. Second priority: recent completed runs (within last 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
        const recentCompleted = runs.find(r => 
          r.status === 'SUCCESS' && 
          r.finished_at && 
          r.finished_at >= twoMinutesAgo
        );
        
        if (recentCompleted) {
          return recentCompleted;
        }

        // 3. Third priority: recent failed runs (within last 30 seconds)
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        const recentFailed = runs.find(r => 
          r.status === 'FAILED' && 
          r.finished_at && 
          r.finished_at >= thirtySecondsAgo
        );
        
        if (recentFailed) {
          return recentFailed;
        }

        // 4. Fallback: show the most meaningful recent run (one that did work)
        const meaningfulRun = runs.find(r => 
          ((r.created_count ?? 0) + (r.updated_count ?? 0)) > 0
        );

        return meaningfulRun ?? null;
      } catch (err) {
        console.warn('Active import run polling exception:', err);
        return null;
      }
    },
    refetchInterval: 2000,
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 1000, // Reduced stale time for faster error state updates
  });
}

// Utility functions for popover summaries
export function getSyncRunSummary(runs: ProductSyncRun[]) {
  const lastRun = runs.find(run => run.direction === 'OUT');
  
  if (!lastRun) {
    return { lastRun: null, timeAgo: null };
  }

  const timeAgo = getTimeAgo(lastRun.started_at);
  return { lastRun, timeAgo };
}

export function getImportRunSummary(runs: any[]) {
  const lastRun = runs[0]; // Import runs are already sorted by started_at desc
  
  if (!lastRun) {
    return { lastRun: null, timeAgo: null };
  }

  const timeAgo = getTimeAgo(lastRun.started_at);
  return { lastRun, timeAgo };
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}