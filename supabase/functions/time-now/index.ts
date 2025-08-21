import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get current time in UTC and America/Chicago timezone
    const nowUtc = new Date();
    const nowCt = new Date(nowUtc.toLocaleString("en-US", { timeZone: "America/Chicago" }));
    
    // Format times for display
    const ctFormatted = nowCt.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const timeOnly = nowCt.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    return new Response(JSON.stringify({
      utc: nowUtc.toISOString(),
      chicago_time: nowCt.toISOString(),
      formatted: ctFormatted,
      time_only: timeOnly,
      timezone: 'America/Chicago'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Time-now error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get time' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});