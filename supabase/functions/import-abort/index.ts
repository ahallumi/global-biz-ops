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

    const { runId, integrationId } = await req.json()

    if (!runId && !integrationId) {
      return new Response(
        JSON.stringify({ error: "Either runId or integrationId is required" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    let targetRunId = runId;

    // If integrationId provided, find the active run
    if (!targetRunId && integrationId) {
      const { data: activeRun, error: findError } = await supabase
        .from('product_import_runs')
        .select('id')
        .eq('integration_id', integrationId)
        .in('status', ['RUNNING', 'PENDING', 'PARTIAL'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (findError) {
        throw new Error(`Failed to find active run: ${findError.message}`)
      }

      if (!activeRun) {
        return new Response(
          JSON.stringify({ error: "No active import run found for this integration" }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404 
          }
        )
      }

      targetRunId = activeRun.id;
    }

    console.log(`Aborting import run: ${targetRunId}`)

    // Get current errors before updating
    const { data: currentRun } = await supabase
      .from('product_import_runs')
      .select('errors')
      .eq('id', targetRunId)
      .maybeSingle();

    // Mark the run as failed with cancellation message
    const { data: updatedRun, error: updateError } = await supabase
      .from('product_import_runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        errors: [
          ...(currentRun?.errors || []),
          {
            timestamp: new Date().toISOString(),
            code: 'USER_CANCELLED',
            message: 'Import cancelled by user'
          }
        ]
      })
      .eq('id', targetRunId)
      .in('status', ['RUNNING', 'PENDING', 'PARTIAL'])
      .select()
      .maybeSingle()

    if (updateError) {
      throw new Error(`Failed to update run: ${updateError.message}`)
    }

    if (!updatedRun) {
      return new Response(
        JSON.stringify({ error: "Import run not found or not in abortable state" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    console.log(`Successfully aborted import run: ${targetRunId}`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Import run aborted successfully',
        run_id: targetRunId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Import abort failed:', error)

    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as any)?.message || 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})