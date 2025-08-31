import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WATCHDOG_RUNNING_MIN = Number(Deno.env.get("WATCHDOG_RUNNING_MIN") ?? 15);
const WATCHDOG_PENDING_MIN = Number(Deno.env.get("WATCHDOG_PENDING_MIN") ?? 5);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      runningMinutes = WATCHDOG_RUNNING_MIN, 
      pendingMinutes = WATCHDOG_PENDING_MIN 
    } = await req.json().catch(() => ({}))

    console.log(`Running import watchdog - RUNNING threshold: ${runningMinutes}m, PENDING threshold: ${pendingMinutes}m`)

    // Use enhanced database function to mark stale runs
    const { data: staleResults, error: markError } = await supabase.rpc('import_mark_stale', {
      running_minutes: runningMinutes,
      pending_minutes: pendingMinutes
    })

    if (markError) {
      throw new Error(`Failed to mark stale runs: ${markError.message}`)
    }

    const cleanedCount = staleResults?.length || 0;
    console.log(`Watchdog complete: ${cleanedCount} stale runs cleaned`)

    if (cleanedCount > 0) {
      console.log('Cleaned runs:', staleResults.map(r => `${r.run_id} (${r.old_status} → ${r.new_status}): ${r.error_msg}`))
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: cleanedCount > 0 
          ? `Cleaned ${cleanedCount} stale import runs` 
          : 'No stale import runs found',
        cleaned_count: cleanedCount,
        details: staleResults || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Watchdog failed:', error)

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})