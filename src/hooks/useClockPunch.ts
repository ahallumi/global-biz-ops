import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type PunchAction = 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';

interface PunchRequest {
  action: PunchAction;
  note?: string;
}

interface PunchResponse {
  success: boolean;
  timestamp: string;
  action: string;
  shift?: any;
  break_duration?: number;
}

export function useClockPunch() {
  const queryClient = useQueryClient();
  
  const punchMutation = useMutation({
    mutationFn: async (request: PunchRequest): Promise<PunchResponse> => {
      const { data, error } = await supabase.functions.invoke('clock-punch', {
        body: request
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to process punch');
      }
      
      return data;
    },
    onSuccess: (data) => {
      // Invalidate related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['current-shift'] });
      queryClient.invalidateQueries({ queryKey: ['punch-events'] });
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
      
      // Show success toast
      const actionLabels = {
        CLOCK_IN: 'Clocked in',
        CLOCK_OUT: 'Clocked out',
        BREAK_START: 'Break started',
        BREAK_END: 'Break ended'
      };
      
      toast({
        title: 'Success',
        description: `${actionLabels[data.action as PunchAction]} at ${new Date(data.timestamp).toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}`
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return {
    punch: punchMutation.mutate,
    isPending: punchMutation.isPending,
    error: punchMutation.error
  };
}