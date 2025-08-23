import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ImportRun {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  processed_count: number;
  created_count: number;
  updated_count: number;
  started_at: string;
  finished_at?: string;
  integration_id: string;
  errors?: any[];
}

export function useImportProgress(integrationId?: string) {
  const [currentImport, setCurrentImport] = useState<ImportRun | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch the latest import run for this integration
  const { data: latestImport, refetch } = useQuery({
    queryKey: ['latest-import-run', integrationId],
    queryFn: async () => {
      if (!integrationId) return null;
      
      const { data, error } = await supabase
        .from('product_import_runs')
        .select('*')
        .eq('integration_id', integrationId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as ImportRun | null;
    },
    enabled: !!integrationId,
    refetchInterval: (query) => {
      // Only refetch if there's an active import
      const importData = query.state.data as ImportRun | null;
      return importData && (importData.status === 'PENDING' || importData.status === 'RUNNING') ? 2000 : false;
    }
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!integrationId) return;

    const subscription = supabase
      .channel('import-progress-tracking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_import_runs',
          filter: `integration_id=eq.${integrationId}`
        },
        (payload) => {
          console.log('Import progress realtime update:', payload);
          
          if (payload.new) {
            const importRun = payload.new as ImportRun;
            setCurrentImport(importRun);
            
            // Update importing state
            setIsImporting(
              importRun.status === 'PENDING' || importRun.status === 'RUNNING'
            );
            
            // Refetch to ensure we have latest data
            refetch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [integrationId, refetch]);

  // Update states when latest import changes
  useEffect(() => {
    if (latestImport) {
      setCurrentImport(latestImport);
      setIsImporting(
        latestImport.status === 'PENDING' || latestImport.status === 'RUNNING'
      );
    }
  }, [latestImport]);

  return {
    currentImport,
    isImporting,
    latestImport,
    refetch
  };
}

export function useActiveImports() {
  const { data: activeImports } = useQuery({
    queryKey: ['active-imports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_import_runs')
        .select('*, inventory_integrations(display_name)')
        .in('status', ['PENDING', 'RUNNING'])
        .order('started_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000, // Check for active imports every 3 seconds
  });

  return {
    activeImports: activeImports || [],
    hasActiveImports: (activeImports || []).length > 0
  };
}