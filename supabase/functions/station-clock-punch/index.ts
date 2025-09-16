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
    const { action, pin }: PunchRequest = await req.json();

    if (!action || !pin) {
      return new Response(JSON.stringify({ error: "Missing action or pin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be 4 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find employee by PIN
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('user_id, full_name, active')
      .eq('staff_pin', pin)
      .eq('active', true)
      .single();

    if (employeeError || !employee) {
      console.log('Employee not found for PIN:', pin, employeeError);
      return new Response(JSON.stringify({ error: "Invalid PIN or inactive employee" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${action} for employee:`, employee.full_name);

    // Process the punch using the existing clock-punch function logic
    const { data: punchResult, error: punchError } = await supabase.functions.invoke('clock-punch', {
      body: {
        action,
        employee_id: employee.user_id,
        source: 'STATION'
      }
    });

    if (punchError) {
      console.error('Clock punch error:', punchError);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: punchError.message || "Failed to process clock action" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!punchResult?.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: punchResult?.error || "Clock punch failed"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionMessages = {
      'CLOCK_IN': `Welcome ${employee.full_name}! Clocked in successfully`,
      'CLOCK_OUT': `Goodbye ${employee.full_name}! Clocked out successfully`, 
      'BREAK_START': `Break started for ${employee.full_name}`,
      'BREAK_END': `Welcome back ${employee.full_name}! Break ended`
    };

    return new Response(JSON.stringify({
      ok: true,
      message: actionMessages[action],
      employee_name: employee.full_name,
      action,
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