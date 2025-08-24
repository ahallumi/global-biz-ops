import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const { thresholdMinutes = 15 } = await req.json().catch(() => ({}))

    console.log(`Running import watchdog with threshold: ${thresholdMinutes} minutes`)

    // Calculate threshold timestamp
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString()

    // Find stale running imports
    const { data: staleRuns, error: findError } = await supabase
      .from('product_import_runs')
      .select('id, integration_id, started_at')
      .eq('status', 'RUNNING')
      .lt('started_at', thresholdTime)

    if (findError) {
      throw new Error(`Failed to find stale runs: ${findError.message}`)
    }

    if (!staleRuns || staleRuns.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No stale import runs found',
          cleaned_count: 0,
          stale_runs: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`Found ${staleRuns.length} stale import runs:`, staleRuns.map(r => r.id))

    // Update stale runs to mark them as failed
    const { data: updatedRuns, error: updateError } = await supabase
      .from('product_import_runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        errors: [`Watchdog timeout — auto-aborted after ${thresholdMinutes} minutes`]
      })
      .in('id', staleRuns.map(r => r.id))
      .select()

    if (updateError) {
      throw new Error(`Failed to update stale runs: ${updateError.message}`)
    }

    console.log(`Successfully cleaned ${updatedRuns?.length || 0} stale import runs`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Cleaned ${updatedRuns?.length || 0} stale import runs`,
        cleaned_count: updatedRuns?.length || 0,
        stale_runs: staleRuns.map(r => ({
          id: r.id,
          started_at: r.started_at,
          elapsed_minutes: Math.floor((Date.now() - new Date(r.started_at).getTime()) / 60000)
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Watchdog failed:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})