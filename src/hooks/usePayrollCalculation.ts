import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface PayrollEntry {
  employeeId: string;
  employeeName: string;
  department: string;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  grossPay: number;
  status: 'pending' | 'approved' | 'paid';
}

export interface PayrollSummary {
  totalEmployees: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  totalPayroll: number;
  payPeriod: string;
}

interface UsePayrollCalculationOptions {
  startDate?: Date;
  endDate?: Date;
  employeeId?: string;
}

export function usePayrollCalculation({ 
  startDate, 
  endDate, 
  employeeId 
}: UsePayrollCalculationOptions = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['payroll-calculation', startDate?.toISOString(), endDate?.toISOString(), employeeId],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');

      const start = startDate?.toISOString().split('T')[0];
      const end = endDate?.toISOString().split('T')[0];

      let query = supabase
        .from('v_time_entries')
        .select(`
          *,
          employees!inner(
            id,
            display_name,
            first_name,
            last_name,
            department,
            hourly_rate,
            pay_type
          )
        `)
        .eq('employees.pay_type', 'hourly')
        .not('clock_out_at', 'is', null);

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      if (start) {
        query = query.gte('work_date', start);
      }

      if (end) {
        query = query.lte('work_date', end);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching payroll data:', error);
        throw error;
      }

      // Group by employee and calculate totals
      const employeeMap = new Map<string, PayrollEntry>();
      
      data?.forEach(entry => {
        const empId = entry.employee_id;
        const employee = entry.employees;
        
        if (!employeeMap.has(empId)) {
          employeeMap.set(empId, {
            employeeId: empId,
            employeeName: employee.display_name || `${employee.first_name} ${employee.last_name}`,
            department: employee.department || 'General',
            regularHours: 0,
            overtimeHours: 0,
            hourlyRate: parseFloat(employee.hourly_rate?.toString() || '15.00'),
            grossPay: 0,
            status: 'pending'
          });
        }

        const payrollEntry = employeeMap.get(empId)!;
        const workHours = parseFloat(entry.work_hours?.toString() || '0');
        
        // Simple overtime calculation: hours over 8 per day are overtime
        const regularHours = Math.min(workHours, 8);
        const overtimeHours = Math.max(0, workHours - 8);
        
        payrollEntry.regularHours += regularHours;
        payrollEntry.overtimeHours += overtimeHours;
      });

      // Calculate gross pay for each employee
      const payrollEntries = Array.from(employeeMap.values()).map(entry => ({
        ...entry,
        grossPay: (entry.regularHours * entry.hourlyRate) + (entry.overtimeHours * entry.hourlyRate * 1.5)
      }));

      // Calculate summary
      const summary: PayrollSummary = {
        totalEmployees: payrollEntries.length,
        totalHours: payrollEntries.reduce((sum, e) => sum + e.regularHours + e.overtimeHours, 0),
        regularHours: payrollEntries.reduce((sum, e) => sum + e.regularHours, 0),
        overtimeHours: payrollEntries.reduce((sum, e) => sum + e.overtimeHours, 0),
        totalPayroll: payrollEntries.reduce((sum, e) => sum + e.grossPay, 0),
        payPeriod: start && end ? `${start} - ${end}` : 'Current Period'
      };

      return {
        entries: payrollEntries,
        summary
      };
    },
    enabled: !!user?.id,
  });
}