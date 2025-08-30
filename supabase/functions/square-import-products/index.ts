import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SQUARE_API_VERSION = '2024-12-18'
const BATCH_SIZE = 100
const MAX_SEGMENT_DURATION_MS = 7 * 60 * 1000 // 7 minutes max per segment

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

    const { integrationId, mode = 'FULL', runId } = await req.json()

    if (!integrationId) {
      throw new Error('Missing integration ID')
    }

    // Handle resume mode - use existing run instead of creating new one
    if (mode === 'RESUME' && runId) {
      console.log('Resuming product import for run:', runId)
      
      // Verify the run exists and is in RUNNING state
      const { data: existingRun } = await supabase
        .from('product_import_runs')
        .select('id, integration_id, status')
        .eq('id', runId)
        .eq('integration_id', integrationId)
        .single()

      if (!existingRun) {
        throw new Error('Import run not found or does not belong to this integration')
      }

      if (existingRun.status !== 'RUNNING') {
        throw new Error(`Cannot resume import with status: ${existingRun.status}`)
      }

      // Resume the background import task
      EdgeRuntime.waitUntil(performImport(runId, integrationId, mode))

      return new Response(
        JSON.stringify({ 
          success: true,
          run_id: runId,
          message: 'Import resumed in background'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Check if there's already a running import for this integration (new imports only)
    const { data: existingRun } = await supabase
      .from('product_import_runs')
      .select('id, status')
      .eq('integration_id', integrationId)
      .in('status', ['RUNNING', 'PENDING'])
      .single()

    if (existingRun) {
      return new Response(
        JSON.stringify({ 
          error: 'Import already in progress',
          existing_run_id: existingRun.id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409 
        }
      )
    }

    console.log('Starting product import for integration:', integrationId, 'mode:', mode)

    // Create import run record with PENDING status
    const { data: importRun, error: runError } = await supabase
      .from('product_import_runs')
      .insert({
        integration_id: integrationId,
        status: 'PENDING'
      })
      .select()
      .single()

    if (runError) {
      throw new Error(`Failed to create import run: ${runError.message}`)
    }

    // Start the background import task
    EdgeRuntime.waitUntil(performImport(importRun.id, integrationId, mode))

    // Return immediate response
    return new Response(
      JSON.stringify({ 
        success: true,
        run_id: importRun.id,
        message: 'Import started in background'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Import initialization failed:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

// Background task function
async function performImport(importRunId: string, integrationId: string, mode: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const segmentStartTime = Date.now()

  try {
    // Update status to RUNNING (for new imports) or get existing state (for resumed imports)
    let currentRun
    if (mode === 'RESUME') {
      const { data } = await supabase
        .from('product_import_runs')
        .select('*')
        .eq('id', importRunId)
        .single()
      
      currentRun = data
      console.log(`Resuming import from cursor: ${currentRun?.cursor || 'beginning'}`)
    } else {
      await supabase
        .from('product_import_runs')
        .update({ status: 'RUNNING' })
        .eq('id', importRunId)
      
      const { data } = await supabase
        .from('product_import_runs')
        .select('*')
        .eq('id', importRunId)
        .single()
      
      currentRun = data
    }

    // Get integration details and credentials
    const appCryptKey = Deno.env.get('APP_CRYPT_KEY2')
    if (!appCryptKey) {
      throw new Error('APP_CRYPT_KEY2 not configured')
    }

    const { data: credentialsData, error: credentialsError } = await supabase.rpc('get_decrypted_credentials', {
      p_integration_id: integrationId,
      p_crypt_key: appCryptKey
    })

    if (credentialsError || !credentialsData || !Array.isArray(credentialsData) || credentialsData.length === 0) {
      throw new Error('Failed to retrieve credentials')
    }

    const { access_token, environment } = credentialsData[0]

    const baseUrl = environment === 'SANDBOX' 
      ? 'https://connect.squareupsandbox.com' 
      : 'https://connect.squareup.com'

    // Initialize from existing run state
    let cursor: string | undefined = currentRun?.cursor || undefined
    let totalProcessed = currentRun?.processed_count || 0
    let totalCreated = currentRun?.created_count || 0
    let totalUpdated = currentRun?.updated_count || 0
    let errors: string[] = currentRun?.errors || []

    console.log(`🚀 Background import ${mode === 'RESUME' ? 'resumed' : 'started'} for run: ${importRunId}`)

    // Import products in batches with time limit
    while (true) {
      try {
        // Check for cancellation before each batch
        const { data: runCheck } = await supabase
          .from('product_import_runs')
          .select('status')
          .eq('id', importRunId)
          .single()

        if (runCheck?.status !== 'RUNNING') {
          console.log('Import was cancelled, stopping...')
          break
        }

        // Check if we're approaching the time limit
        const elapsedTime = Date.now() - segmentStartTime
        if (elapsedTime > MAX_SEGMENT_DURATION_MS) {
          console.log(`Time limit reached (${elapsedTime}ms), scheduling continuation...`)
          
          // Update progress and schedule next segment
          await supabase
            .from('product_import_runs')
            .update({
              processed_count: totalProcessed,
              created_count: totalCreated,
              updated_count: totalUpdated,
              cursor: cursor
            })
            .eq('id', importRunId)

          // Self-invoke to continue import in next segment
          await continueImport(integrationId, importRunId)
          return
        }

        // Build query parameters
        const params = new URLSearchParams({
          types: 'ITEM,ITEM_VARIATION',
          limit: BATCH_SIZE.toString()
        })
        
        if (cursor) {
          params.append('cursor', cursor)
        }

        const response = await fetch(`${baseUrl}/v2/catalog/list?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Square-Version': SQUARE_API_VERSION,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })

        if (!response.ok) {
          const errorData = await response.text()
          throw new Error(`Square API error: ${response.status} - ${errorData}`)
        }

        const data = await response.json()
        const objects = data.objects || []

        if (objects.length === 0) {
          break // No more data
        }

        // Process items and variations
        const items = objects.filter((obj: any) => obj.type === 'ITEM')
        const variations = objects.filter((obj: any) => obj.type === 'ITEM_VARIATION')

        for (const item of items) {
          const itemVariations = variations.filter((v: any) => 
            v.item_variation_data?.item_id === item.id
          )

          // If no variations, create a single product
          if (itemVariations.length === 0) {
            const result = await processProduct(supabase, item, null, integrationId)
            if (result.created) totalCreated++
            else if (result.updated) totalUpdated++
            totalProcessed++
          } else {
            // Create a product for each variation
            for (const variation of itemVariations) {
              const result = await processProduct(supabase, item, variation, integrationId)
              if (result.created) totalCreated++
              else if (result.updated) totalUpdated++
              totalProcessed++
            }
          }
        }

        cursor = data.cursor

        // Update progress after each batch
        await supabase
          .from('product_import_runs')
          .update({
            processed_count: totalProcessed,
            created_count: totalCreated,
            updated_count: totalUpdated,
            cursor: cursor
          })
          .eq('id', importRunId)

        console.log(`Background import progress: ${totalProcessed} products processed...`)

        if (!cursor) {
          break // No more pages
        }

      } catch (batchError) {
        console.error('Batch processing error:', batchError)
        errors.push(`Batch error: ${batchError.message}`)
        
        // Continue processing other batches instead of breaking completely
        if (cursor) {
          console.log('Continuing with next batch after error...')
          continue
        } else {
          break
        }
      }
    }

    // Update import run with results
    const finalStatus = errors.length > 0 ? 'PARTIAL' : 'SUCCESS'
    
    await supabase
      .from('product_import_runs')
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        processed_count: totalProcessed,
        created_count: totalCreated,
        updated_count: totalUpdated,
        errors: errors,
        cursor: cursor || null
      })
      .eq('id', importRunId)

    // Update integration success status
    await supabase
      .from('inventory_integrations')
      .update({
        last_success_at: new Date().toISOString(),
        last_error: errors.length > 0 ? errors[0] : null
      })
      .eq('id', integrationId)

    console.log(`Background import completed: ${totalProcessed} processed, ${totalCreated} created, ${totalUpdated} updated`)

  } catch (error) {
    console.error('Background import failed:', error)
    
    // Mark import as failed with more context
    const errorMessage = error.message || String(error)
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('CPU Time exceeded')
    
    await supabase
      .from('product_import_runs')
      .update({
        status: isTimeout ? 'PARTIAL' : 'FAILED',
        finished_at: new Date().toISOString(),
        errors: [errorMessage],
        // Preserve progress on timeout
        ...(isTimeout && {
          processed_count: currentRun?.processed_count || 0,
          created_count: currentRun?.created_count || 0,
          updated_count: currentRun?.updated_count || 0,
          cursor: currentRun?.cursor || null
        })
      })
      .eq('id', importRunId)

    // Update integration error status
    await supabase
      .from('inventory_integrations')
      .update({
        last_error: errorMessage
      })
      .eq('id', integrationId)
  }
}

// Helper function to continue import in next segment
async function continueImport(integrationId: string, runId: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    
    const response = await fetch(`${supabaseUrl}/functions/v1/square-import-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        integrationId,
        runId,
        mode: 'RESUME'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to continue import: ${response.status} - ${errorText}`)
    }

    console.log('Successfully scheduled import continuation')
  } catch (error) {
    console.error('Failed to schedule import continuation:', error)
    
    // Mark the import as failed if we can't continue
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabase
      .from('product_import_runs')
      .update({
        status: 'FAILED',
        finished_at: new Date().toISOString(),
        errors: [`Failed to schedule continuation: ${error.message}`]
      })
      .eq('id', runId)
  }
}

async function processProduct(
  supabase: any, 
  item: any, 
  variation: any, 
  integrationId: string
): Promise<{ created?: boolean; updated?: boolean }> {
  try {
    const itemData = item.item_data || {}
    const variationData = variation?.item_variation_data || {}
    
    // Determine unit of sale based on measurement unit or other indicators
    let unitOfSale = 'EACH'
    if (variationData.measurement_unit_id || 
        itemData.name?.toLowerCase().includes('lb') ||
        itemData.name?.toLowerCase().includes('pound') ||
        itemData.description?.toLowerCase().includes('weight')) {
      unitOfSale = 'WEIGHT'
    }

    // Build product data
    const productData = {
      name: itemData.name || 'Unnamed Product',
      sku: variationData.sku || null,
      upc: variationData.upc || null,
      plu: variationData.plu || null,
      unit_of_sale: unitOfSale,
      weight_unit: unitOfSale === 'WEIGHT' ? 'LB' : null,
      retail_price_cents: variationData.price_money?.amount || null,
      category: itemData.category_id || null,
      size: variationData.name !== itemData.name ? variationData.name : null,
      catalog_status: (itemData.is_deleted || variationData.is_deleted) ? 'ARCHIVED' : 'ACTIVE',
      updated_at: new Date().toISOString()
    }

    // Check if product already exists by POS link
    const { data: existingLink } = await supabase
      .from('product_pos_links')
      .select('product_id, products(*)')
      .eq('source', 'SQUARE')
      .eq('pos_item_id', item.id)
      .eq('pos_variation_id', variation?.id || null)
      .single()

    let productId: string
    let created = false
    let updated = false

    if (existingLink) {
      // Update existing product
      const { error: updateError } = await supabase
        .from('products')
        .update(productData)
        .eq('id', existingLink.product_id)

      if (updateError) {
        throw updateError
      }

      productId = existingLink.product_id
      updated = true
    } else {
      // Create new product
      const { data: newProduct, error: createError } = await supabase
        .from('products')
        .insert(productData)
        .select('id')
        .single()

      if (createError) {
        throw createError
      }

      productId = newProduct.id
      created = true

      // Create POS link
      await supabase
        .from('product_pos_links')
        .insert({
          product_id: productId,
          source: 'SQUARE',
          pos_item_id: item.id,
          pos_variation_id: variation?.id || null,
          location_id: null // TODO: Handle location-specific variations
        })
    }

    return { created, updated }

  } catch (error) {
    console.error('Error processing product:', error)
    throw error
  }
}