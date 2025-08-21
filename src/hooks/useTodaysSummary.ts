import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface PunchEvent {
  id: string;
  kind: string;
  event_at: string;
  note: string | null;
}

interface TodaysSummary {
  totalSeconds: number;
  breakSeconds: number;
  netSeconds: number;
  punchEvents: PunchEvent[];
  currentShift: any;
}

export function useTodaysSummary() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['today-summary', user?.id],
    queryFn: async (): Promise<TodaysSummary> => {
      if (!user?.id) {
        return { totalSeconds: 0, breakSeconds: 0, netSeconds: 0, punchEvents: [], currentShift: null };
      }

      // Get today's date in Chicago timezone
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

      // Get today's timesheet data
      const { data: timesheetData, error: timesheetError } = await supabase
        .from('v_timesheet_daily')
        .select('*')
        .eq('employee_id', user.id)
        .eq('day_ct', today)
        .maybeSingle();

      if (timesheetError) {
        console.error('Error fetching timesheet:', timesheetError);
      }

      // Get punch events for today
      const startOfDay = new Date(today + 'T00:00:00.000-05:00').toISOString(); // CST offset
      const endOfDay = new Date(today + 'T23:59:59.999-05:00').toISOString();

      const { data: punchEvents, error: punchError } = await supabase
        .from('punch_events')
        .select('id, kind, event_at, note')
        .eq('employee_id', user.id)
        .gte('event_at', startOfDay)
        .lte('event_at', endOfDay)
        .order('event_at', { ascending: false })
        .limit(10);

      if (punchError) {
        console.error('Error fetching punch events:', punchError);
      }

      // Get current open shift
      const { data: currentShift } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .eq('status', 'OPEN')
        .maybeSingle();

      return {
        totalSeconds: timesheetData?.net_seconds || 0,
        breakSeconds: timesheetData?.break_seconds || 0,
        netSeconds: (timesheetData?.net_seconds || 0) - (timesheetData?.break_seconds || 0),
        punchEvents: punchEvents || [],
        currentShift
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}