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

    console.log(`🐕 Running import watchdog with threshold: ${thresholdMinutes} minutes`)

    // Calculate threshold timestamp based on last_updated_at or started_at
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString()

    // Find stale running imports - check both started_at and last_updated_at
    const { data: staleRuns, error: findError } = await supabase
      .from('product_import_runs')
      .select('id, integration_id, started_at, last_updated_at, processed_count')
      .eq('status', 'RUNNING')
      .or(`started_at.lt.${thresholdTime},last_updated_at.lt.${thresholdTime}`)

    if (findError) {
      throw new Error(`Failed to find stale runs: ${findError.message}`)
    }

    if (!staleRuns || staleRuns.length === 0) {
      console.log('✅ No stale import runs found')
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

    console.log(`🚨 Found ${staleRuns.length} stale import runs:`)
    staleRuns.forEach(run => {
      const elapsedFromStart = Math.floor((Date.now() - new Date(run.started_at).getTime()) / 60000)
      const lastActivity = run.last_updated_at || run.started_at
      const elapsedFromLastActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 60000)
      
      console.log(`  - Run ${run.id}: ${elapsedFromStart}min since start, ${elapsedFromLastActivity}min since last activity, ${run.processed_count || 0} processed`)
    })

    // Update stale runs to mark them as failed
    const { data: updatedRuns, error: updateError } = await supabase
      .from('product_import_runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        errors: [`Watchdog timeout — auto-aborted after ${thresholdMinutes} minutes of inactivity`]
      })
      .in('id', staleRuns.map(r => r.id))
      .select()

    if (updateError) {
      throw new Error(`Failed to update stale runs: ${updateError.message}`)
    }

    console.log(`🔧 Successfully cleaned ${updatedRuns?.length || 0} stale import runs`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Cleaned ${updatedRuns?.length || 0} stale import runs`,
        cleaned_count: updatedRuns?.length || 0,
        stale_runs: staleRuns.map(r => ({
          id: r.id,
          started_at: r.started_at,
          last_updated_at: r.last_updated_at,
          processed_count: r.processed_count || 0,
          elapsed_minutes: Math.floor((Date.now() - new Date(r.started_at).getTime()) / 60000),
          idle_minutes: Math.floor((Date.now() - new Date(r.last_updated_at || r.started_at).getTime()) / 60000)
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Watchdog failed:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})