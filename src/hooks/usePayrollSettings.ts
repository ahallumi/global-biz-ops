import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface PayrollSettings {
  id: number;
  payroll_day: number;
  overtime_daily: number;
  overtime_weekly: number;
  rounding_minutes: number;
  timezone: string;
  pay_period: string;
  created_at?: string;
  updated_at?: string;
}

export function usePayrollSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('payroll_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching payroll settings:', error);
        throw error;
      }

      return data as PayrollSettings;
    },
    enabled: !!user?.id,
  });
}

export function useUpdatePayrollSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<PayrollSettings>) => {
      const { data, error } = await supabase
        .from('payroll_settings')
        .update(settings)
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] });
      toast({
        title: 'Success',
        description: 'Payroll settings updated successfully',
      });
    },
    onError: (error) => {
      console.error('Error updating payroll settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update payroll settings',
        variant: 'destructive',
      });
    },
  });
}