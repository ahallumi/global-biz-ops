import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PayrollCalcRequest {
  employee_id?: string; // null for all employees
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  rounding_minutes?: number; // optional override
  timezone?: string; // optional override
}

interface PayrollEntry {
  date: string;
  clock_in: string;
  clock_out?: string;
  hours: number;
  overtime_hours: number;
  break_minutes: number;
}

interface PayrollResult {
  employee_id: string;
  employee_name: string;
  regular_hours: number;
  overtime_hours: number;
  doubletime_hours: number;
  total_break_minutes: number;
  hourly_rate: number;
  gross_regular: number;
  gross_overtime: number;
  gross_total: number;
  entries: PayrollEntry[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify admin auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (empError || employee?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData: PayrollCalcRequest = await req.json();
    const { employee_id, start_date, end_date, rounding_minutes, timezone } = requestData;

    // Get payroll settings
    const { data: settings, error: settingsError } = await supabase
      .from('payroll_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (settingsError) {
      return new Response(
        JSON.stringify({ error: "Failed to get payroll settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveRounding = rounding_minutes || settings.rounding_minutes;
    const effectiveTimezone = timezone || settings.timezone;

    // Get employees to calculate for
    let employeeQuery = supabase
      .from('employees')
      .select('id, display_name, hourly_rate_cents, pay_type, status')
      .eq('status', 'active');

    if (employee_id) {
      employeeQuery = employeeQuery.eq('id', employee_id);
    }

    const { data: employees, error: employeesError } = await employeeQuery;

    if (employeesError) {
      return new Response(
        JSON.stringify({ error: employeesError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: PayrollResult[] = [];

    for (const emp of employees) {
      if (emp.pay_type !== 'hourly') continue; // Skip salary employees for now

      const payrollData = await calculateEmployeePayroll(
        supabase,
        emp.id,
        start_date,
        end_date,
        effectiveRounding,
        effectiveTimezone,
        settings.overtime_daily,
        settings.overtime_weekly
      );

      results.push({
        employee_id: emp.id,
        employee_name: emp.display_name,
        regular_hours: payrollData.regular_hours,
        overtime_hours: payrollData.overtime_hours,
        doubletime_hours: 0, // MVP: keep at 0
        total_break_minutes: payrollData.total_break_minutes,
        hourly_rate: emp.hourly_rate_cents / 100,
        gross_regular: (emp.hourly_rate_cents / 100) * payrollData.regular_hours,
        gross_overtime: (emp.hourly_rate_cents / 100) * payrollData.overtime_hours * 1.5,
        gross_total: (emp.hourly_rate_cents / 100) * payrollData.regular_hours + 
                    (emp.hourly_rate_cents / 100) * payrollData.overtime_hours * 1.5,
        entries: payrollData.entries
      });
    }

    return new Response(
      JSON.stringify({ payroll: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Payroll calculation error:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function calculateEmployeePayroll(
  supabase: any,
  employeeId: string,
  startDate: string,
  endDate: string,
  roundingMinutes: number,
  timezone: string,
  overtimeDaily: number,
  overtimeWeekly: number
) {
  // Get all shifts for the employee in the date range
  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('clock_in_at', startDate)
    .lte('clock_in_at', endDate + ' 23:59:59')
    .not('clock_out_at', 'is', null)
    .order('clock_in_at');

  if (error) {
    throw new Error(`Failed to get shifts: ${error.message}`);
  }

  const entries: PayrollEntry[] = [];
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalBreakMinutes = 0;

  // Group shifts by day for daily overtime calculation
  const shiftsByDay = new Map<string, any[]>();
  
  for (const shift of shifts) {
    const workDate = new Date(shift.clock_in_at).toLocaleDateString('en-CA'); // YYYY-MM-DD format
    
    if (!shiftsByDay.has(workDate)) {
      shiftsByDay.set(workDate, []);
    }
    shiftsByDay.get(workDate)!.push(shift);
  }

  // Calculate hours for each day
  for (const [date, dayShifts] of shiftsByDay) {
    let dayRegularHours = 0;
    let dayOvertimeHours = 0;
    let dayBreakMinutes = 0;

    for (const shift of dayShifts) {
      const clockIn = new Date(shift.clock_in_at);
      const clockOut = new Date(shift.clock_out_at);
      
      // Calculate raw hours
      const rawHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const breakHours = shift.break_seconds / 3600;
      const workHours = rawHours - breakHours;

      // Apply rounding
      const roundedHours = Math.round(workHours * (60 / roundingMinutes)) / (60 / roundingMinutes);
      
      dayRegularHours += roundedHours;
      dayBreakMinutes += shift.break_seconds / 60;

      entries.push({
        date,
        clock_in: shift.clock_in_at,
        clock_out: shift.clock_out_at,
        hours: roundedHours,
        overtime_hours: 0, // Will be calculated below
        break_minutes: shift.break_seconds / 60
      });
    }

    // Apply daily overtime rules
    if (dayRegularHours > overtimeDaily) {
      const dailyOvertime = dayRegularHours - overtimeDaily;
      dayOvertimeHours += dailyOvertime;
      dayRegularHours = overtimeDaily;
      
      // Update entries for this day with overtime split
      const dayEntries = entries.filter(e => e.date === date);
      if (dayEntries.length > 0) {
        // Apply overtime to the last entry of the day (simplified approach)
        dayEntries[dayEntries.length - 1].overtime_hours = dailyOvertime;
        dayEntries[dayEntries.length - 1].hours -= dailyOvertime;
      }
    }

    totalRegularHours += dayRegularHours;
    totalOvertimeHours += dayOvertimeHours;
    totalBreakMinutes += dayBreakMinutes;
  }

  // Apply weekly overtime rules (take the greater of daily vs weekly OT)
  const weeklyOvertimeHours = Math.max(0, totalRegularHours + totalOvertimeHours - overtimeWeekly);
  if (weeklyOvertimeHours > totalOvertimeHours) {
    const additionalWeeklyOT = weeklyOvertimeHours - totalOvertimeHours;
    totalOvertimeHours = weeklyOvertimeHours;
    totalRegularHours -= additionalWeeklyOT;
  }

  return {
    regular_hours: Math.max(0, totalRegularHours),
    overtime_hours: totalOvertimeHours,
    total_break_minutes: totalBreakMinutes,
    entries
  };
}