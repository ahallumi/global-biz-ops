import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PunchRequest {
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  pin: string;
  station_id?: string;
}

// Helper function to hash PIN for verification
async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, pin, station_id }: PunchRequest = await req.json();

    if (!action || !pin) {
      return new Response(JSON.stringify({ error: "Missing action or pin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be 4-6 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find employee by PIN
    const { data: employees, error: employeeError } = await supabase
      .from('employees')
      .select('id, display_name, status, pin_salt, pin_hash')
      .eq('status', 'active')
      .not('pin_hash', 'is', null);

    if (employeeError) {
      console.error('Error fetching employees:', employeeError);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify PIN against all active employees
    let matchedEmployee = null;
    for (const emp of employees) {
      if (emp.pin_salt && emp.pin_hash) {
        const computedHash = await hashPin(pin, emp.pin_salt);
        if (computedHash === emp.pin_hash) {
          matchedEmployee = emp;
          break;
        }
      }
    }

    if (!matchedEmployee) {
      console.log('PIN not found or invalid:', pin);
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${action} for employee:`, matchedEmployee.display_name);

    // Handle the punch action
    const result = await handlePunchAction(
      supabase,
      action,
      matchedEmployee.id,
      station_id
    );

    if (!result.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: result.error
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionMessages = {
      'CLOCK_IN': `Welcome ${matchedEmployee.display_name}! Clocked in successfully`,
      'CLOCK_OUT': `Goodbye ${matchedEmployee.display_name}! Clocked out successfully`,
      'BREAK_START': `Break started for ${matchedEmployee.display_name}`,
      'BREAK_END': `Welcome back ${matchedEmployee.display_name}! Break ended`
    };

    return new Response(JSON.stringify({
      ok: true,
      message: actionMessages[action],
      employee_name: matchedEmployee.display_name,
      employee_id: matchedEmployee.id,
      action,
      shift_id: result.shift_id,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Station clock punch error:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: "Internal server error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handlePunchAction(
  supabase: any,
  action: string,
  employeeId: string,
  stationId?: string
): Promise<{ success: boolean; error?: string; shift_id?: string }> {
  
  try {
    switch (action) {
      case 'CLOCK_IN':
        return await handleClockIn(supabase, employeeId, stationId);
      
      case 'CLOCK_OUT':
        return await handleClockOut(supabase, employeeId);
      
      case 'BREAK_START':
        return await handleBreakStart(supabase, employeeId);
      
      case 'BREAK_END':
        return await handleBreakEnd(supabase, employeeId);
      
      default:
        return { success: false, error: "Invalid action" };
    }
  } catch (error) {
    console.error('Punch action error:', error);
    return { success: false, error: "Failed to process punch action" };
  }
}

async function handleClockIn(supabase: any, employeeId: string, stationId?: string) {
  // Check if employee already has an open shift
  const { data: openShift, error: checkError } = await supabase
    .from('shifts')
    .select('id')
    .eq('employee_id', employeeId)
    .is('clock_out_at', null)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    return { success: false, error: "Database error checking open shifts" };
  }

  if (openShift) {
    return { success: false, error: "You are already clocked in" };
  }

  // Create new shift
  const { data: shift, error: insertError } = await supabase
    .from('shifts')
    .insert({
      employee_id: employeeId,
      clock_in_at: new Date().toISOString(),
      status: 'OPEN'
    })
    .select('id')
    .single();

  if (insertError) {
    return { success: false, error: "Failed to clock in" };
  }

  // Create punch event
  await supabase
    .from('punch_events')
    .insert({
      employee_id: employeeId,
      shift_id: shift.id,
      kind: 'CLOCK_IN',
      source: 'STATION',
      event_at: new Date().toISOString()
    });

  return { success: true, shift_id: shift.id };
}

async function handleClockOut(supabase: any, employeeId: string) {
  // Find the open shift
  const { data: openShift, error: findError } = await supabase
    .from('shifts')
    .select('id, clock_in_at, break_seconds, break_open_at')
    .eq('employee_id', employeeId)
    .is('clock_out_at', null)
    .single();

  if (findError) {
    return { success: false, error: "No open shift found" };
  }

  // If on break, end the break first
  let finalBreakSeconds = openShift.break_seconds;
  if (openShift.break_open_at) {
    const breakStart = new Date(openShift.break_open_at);
    const currentBreakTime = Math.floor((Date.now() - breakStart.getTime()) / 1000);
    finalBreakSeconds += currentBreakTime;
  }

  // Close the shift
  const { error: updateError } = await supabase
    .from('shifts')
    .update({
      clock_out_at: new Date().toISOString(),
      break_seconds: finalBreakSeconds,
      break_open_at: null,
      status: 'CLOSED'
    })
    .eq('id', openShift.id);

  if (updateError) {
    return { success: false, error: "Failed to clock out" };
  }

  // Create punch event
  await supabase
    .from('punch_events')
    .insert({
      employee_id: employeeId,
      shift_id: openShift.id,
      kind: 'CLOCK_OUT',
      source: 'STATION',
      event_at: new Date().toISOString()
    });

  return { success: true, shift_id: openShift.id };
}

async function handleBreakStart(supabase: any, employeeId: string) {
  // Find the open shift
  const { data: openShift, error: findError } = await supabase
    .from('shifts')
    .select('id, break_open_at')
    .eq('employee_id', employeeId)
    .is('clock_out_at', null)
    .single();

  if (findError) {
    return { success: false, error: "No open shift found" };
  }

  if (openShift.break_open_at) {
    return { success: false, error: "Break already started" };
  }

  // Start break
  const { error: updateError } = await supabase
    .from('shifts')
    .update({
      break_open_at: new Date().toISOString()
    })
    .eq('id', openShift.id);

  if (updateError) {
    return { success: false, error: "Failed to start break" };
  }

  // Create punch event
  await supabase
    .from('punch_events')
    .insert({
      employee_id: employeeId,
      shift_id: openShift.id,
      kind: 'BREAK_START',
      source: 'STATION',
      event_at: new Date().toISOString()
    });

  return { success: true, shift_id: openShift.id };
}

async function handleBreakEnd(supabase: any, employeeId: string) {
  // Find the open shift
  const { data: openShift, error: findError } = await supabase
    .from('shifts')
    .select('id, break_seconds, break_open_at')
    .eq('employee_id', employeeId)
    .is('clock_out_at', null)
    .single();

  if (findError) {
    return { success: false, error: "No open shift found" };
  }

  if (!openShift.break_open_at) {
    return { success: false, error: "No break to end" };
  }

  // Calculate break duration
  const breakStart = new Date(openShift.break_open_at);
  const breakDuration = Math.floor((Date.now() - breakStart.getTime()) / 1000);
  const totalBreakSeconds = openShift.break_seconds + breakDuration;

  // End break
  const { error: updateError } = await supabase
    .from('shifts')
    .update({
      break_seconds: totalBreakSeconds,
      break_open_at: null
    })
    .eq('id', openShift.id);

  if (updateError) {
    return { success: false, error: "Failed to end break" };
  }

  // Create punch event
  await supabase
    .from('punch_events')
    .insert({
      employee_id: employeeId,
      shift_id: openShift.id,
      kind: 'BREAK_END',
      source: 'STATION',
      event_at: new Date().toISOString()
    });

  return { success: true, shift_id: openShift.id };
}