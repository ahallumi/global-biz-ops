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
      const { data, error } = await supabase.functions.invoke('square-import-products', {
        body: {}
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
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to import from Square: ${error.message}`,
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
        // First check for truly active runs
        const { data: activeData, error: activeError } = await supabase
          .from('product_import_runs')
          .select('*')
          .is('finished_at', null)
          .in('status', ['RUNNING', 'PENDING'])
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeError) {
          console.warn('Active import run polling error:', activeError);
          return null;
        }

        if (activeData) {
          return activeData;
        }

        // If no active runs, check for recent failed runs (within last 30 seconds)
        // This helps users see error states briefly before they disappear
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        const { data: failedData, error: failedError } = await supabase
          .from('product_import_runs')
          .select('*')
          .eq('status', 'FAILED')
          .gte('finished_at', thirtySecondsAgo)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (failedError) {
          console.warn('Failed import run polling error:', failedError);
          return null;
        }

        return failedData ?? null;
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