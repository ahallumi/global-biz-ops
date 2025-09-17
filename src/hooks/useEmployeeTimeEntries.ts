import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TimeEntry {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  totalHours: number;
  status: 'completed' | 'open' | 'break';
}

interface UseEmployeeTimeEntriesOptions {
  employeeId: string;
  dateFilter?: Date;
  statusFilter?: string;
}

export function useEmployeeTimeEntries({ 
  employeeId, 
  dateFilter, 
  statusFilter 
}: UseEmployeeTimeEntriesOptions) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['employee-time-entries', employeeId, dateFilter?.toISOString(), statusFilter],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      let query = supabase
        .from('v_time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('work_date', { ascending: false });

      // Apply date filter if provided
      if (dateFilter) {
        const filterDate = dateFilter.toISOString().split('T')[0];
        query = query.eq('work_date', filterDate);
      }

      // Apply status filter if provided
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching time entries:', error);
        throw error;
      }

      // Map database results to component interface
      const timeEntries: TimeEntry[] = (data || []).map(entry => ({
        id: entry.id || '',
        date: entry.work_date?.toString() || '',
        clockIn: entry.clock_in_at || '',
        clockOut: entry.clock_out_at || null,
        breakMinutes: Math.round(entry.break_minutes || 0),
        totalHours: parseFloat((entry.work_hours || 0).toString()),
        status: entry.clock_out_at ? 'completed' : 'open'
      }));

      return timeEntries;
    },
    enabled: !!user?.id && !!employeeId,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}