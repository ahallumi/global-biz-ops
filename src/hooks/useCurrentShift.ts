import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Shift {
  id: string;
  employee_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_seconds: number;
  break_open_at: string | null;
  status: 'OPEN' | 'CLOSED' | 'ADJUSTED';
  created_at: string;
  updated_at: string;
}

export function useCurrentShift() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current-shift', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .eq('status', 'OPEN')
        .maybeSingle();

      if (error) {
        console.error('Error fetching current shift:', error);
        throw error;
      }

      return data as Shift | null;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}