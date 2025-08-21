import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PunchRequest {
  action: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  note?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (empError || !employee) {
      console.error('Employee error:', empError);
      return new Response(JSON.stringify({ error: 'Employee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, note } = await req.json() as PunchRequest;
    
    // Get server time in America/Chicago timezone
    const nowUtc = new Date();
    const nowCt = new Date(nowUtc.toLocaleString("en-US", { timeZone: "America/Chicago" }));
    
    // Get time settings for rounding
    const { data: settings } = await supabase
      .from('time_settings')
      .select('*')
      .single();
    
    const roundingMinutes = settings?.rounding_minutes || 1;
    
    // Round time to nearest rounding interval
    const roundedTime = new Date(Math.round(nowCt.getTime() / (roundingMinutes * 60000)) * (roundingMinutes * 60000));
    
    // Get current open shift
    const { data: openShift, error: shiftError } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_id', employee.user_id)
      .eq('status', 'OPEN')
      .maybeSingle();

    if (shiftError) {
      console.error('Shift query error:', shiftError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let result;
    let shiftId = openShift?.id;

    switch (action) {
      case 'CLOCK_IN':
        if (openShift) {
          return new Response(JSON.stringify({ error: 'Already clocked in' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create new shift
        const { data: newShift, error: createShiftError } = await supabase
          .from('shifts')
          .insert({
            employee_id: employee.user_id,
            clock_in_at: roundedTime.toISOString(),
            status: 'OPEN'
          })
          .select()
          .single();

        if (createShiftError) {
          console.error('Create shift error:', createShiftError);
          return new Response(JSON.stringify({ error: 'Failed to clock in' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        shiftId = newShift.id;
        result = { action: 'CLOCK_IN', shift: newShift };
        break;

      case 'BREAK_START':
        if (!openShift) {
          return new Response(JSON.stringify({ error: 'Not clocked in' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (openShift.break_open_at) {
          return new Response(JSON.stringify({ error: 'Already on break' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Start break
        const { error: startBreakError } = await supabase
          .from('shifts')
          .update({ break_open_at: roundedTime.toISOString() })
          .eq('id', openShift.id);

        if (startBreakError) {
          console.error('Start break error:', startBreakError);
          return new Response(JSON.stringify({ error: 'Failed to start break' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        result = { action: 'BREAK_START' };
        break;

      case 'BREAK_END':
        if (!openShift || !openShift.break_open_at) {
          return new Response(JSON.stringify({ error: 'Not on break' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Calculate break duration in seconds
        const breakStart = new Date(openShift.break_open_at);
        const breakDuration = Math.floor((roundedTime.getTime() - breakStart.getTime()) / 1000);
        
        // End break and add to total break seconds
        const { error: endBreakError } = await supabase
          .from('shifts')
          .update({ 
            break_open_at: null,
            break_seconds: (openShift.break_seconds || 0) + breakDuration
          })
          .eq('id', openShift.id);

        if (endBreakError) {
          console.error('End break error:', endBreakError);
          return new Response(JSON.stringify({ error: 'Failed to end break' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Insert break record
        await supabase
          .from('shift_breaks')
          .insert({
            shift_id: openShift.id,
            start_at: openShift.break_open_at,
            end_at: roundedTime.toISOString(),
            kind: settings?.default_break_kind || 'UNPAID'
          });

        result = { action: 'BREAK_END', break_duration: breakDuration };
        break;

      case 'CLOCK_OUT':
        if (!openShift) {
          return new Response(JSON.stringify({ error: 'Not clocked in' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let finalBreakSeconds = openShift.break_seconds || 0;

        // If on break, automatically end it
        if (openShift.break_open_at) {
          const breakStart = new Date(openShift.break_open_at);
          const breakDuration = Math.floor((roundedTime.getTime() - breakStart.getTime()) / 1000);
          finalBreakSeconds += breakDuration;

          // Insert final break record
          await supabase
            .from('shift_breaks')
            .insert({
              shift_id: openShift.id,
              start_at: openShift.break_open_at,
              end_at: roundedTime.toISOString(),
              kind: settings?.default_break_kind || 'UNPAID'
            });
        }

        // Close shift
        const { error: closeShiftError } = await supabase
          .from('shifts')
          .update({ 
            clock_out_at: roundedTime.toISOString(),
            break_open_at: null,
            break_seconds: finalBreakSeconds,
            status: 'CLOSED'
          })
          .eq('id', openShift.id);

        if (closeShiftError) {
          console.error('Close shift error:', closeShiftError);
          return new Response(JSON.stringify({ error: 'Failed to clock out' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        result = { action: 'CLOCK_OUT' };
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Record punch event
    await supabase
      .from('punch_events')
      .insert({
        employee_id: employee.user_id,
        shift_id: shiftId,
        kind: action,
        event_at: roundedTime.toISOString(),
        source: 'WEB',
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        note: note || null
      });

    console.log(`Punch recorded: ${action} for employee ${employee.user_id} at ${roundedTime.toISOString()}`);

    return new Response(JSON.stringify({ 
      success: true, 
      timestamp: roundedTime.toISOString(),
      ...result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Clock punch error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});