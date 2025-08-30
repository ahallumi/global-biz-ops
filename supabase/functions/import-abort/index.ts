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

    const { runId } = await req.json()

    if (!runId) {
      throw new Error('Missing runId parameter')
    }

    console.log('Aborting import run:', runId)

    // Update the import run to mark it as cancelled
    const { data: updatedRun, error: updateError } = await supabase
      .from('product_import_runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        errors: ['Cancelled by user']
      })
      .eq('id', runId)
      .eq('status', 'RUNNING') // Only abort if currently running
      .select()
      .single()

    if (updateError) {
      console.error('Failed to abort import run:', updateError)
      throw new Error(`Failed to abort import: ${updateError.message}`)
    }

    if (!updatedRun) {
      return new Response(
        JSON.stringify({ error: 'Import run not found or not currently running. Only RUNNING imports can be aborted.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('Import run aborted successfully:', runId)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Import run aborted successfully',
        run_id: runId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Abort failed:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})