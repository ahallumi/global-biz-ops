import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SQUARE_API_VERSION = '2024-12-18'
const BATCH_SIZE = 100

// Helper function for exponential backoff delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry wrapper for Square API calls
async function retrySquareApiCall<T>(
  apiCall: () => Promise<T>,
  operation: string,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall()
    } catch (error) {
      const isRetryableError = error.name === 'TimeoutError' || 
                              (error.message && error.message.includes('429')) ||
                              (error.message && error.message.includes('connection'))

      if (attempt === maxRetries || !isRetryableError) {
        console.error(`${operation} failed after ${attempt} attempts:`, error.message)
        throw error
      }

      const backoffDelay = Math.min(100 * Math.pow(2, attempt - 1), 1000) // 100ms, 200ms, 400ms, max 1000ms
      console.log(`${operation} failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffDelay}ms...`)
      await sleep(backoffDelay)
    }
  }
}

// Safe progress update wrapper
async function safeUpdateProgress(
  supabase: any,
  runId: string,
  updates: any,
  operation: string
): Promise<void> {
  try {
    await supabase
      .from('product_import_runs')
      .update({
        ...updates,
        last_updated_at: new Date().toISOString()
      })
      .eq('id', runId)
  } catch (error) {
    console.error(`Failed to update progress for ${operation}:`, error.message)
    // Don't throw - continue processing
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let runId: string | null = null
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { integrationId, mode = 'FULL' } = await req.json()

    if (!integrationId) {
      throw new Error('Missing integration ID')
    }

    console.log(`🚀 Starting product import for integration: ${integrationId}, mode: ${mode}`)

    // Create import run record
    const { data: importRun, error: runError } = await supabase
      .from('product_import_runs')
      .insert({
        integration_id: integrationId,
        status: 'RUNNING',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (runError) {
      throw new Error(`Failed to create import run: ${runError.message}`)
    }

    runId = importRun.id
    console.log(`📋 Created import run: ${runId}`)

    // Get integration details and credentials
    console.log('🔐 [square-import-products] APP_CRYPT_KEY exists:', !!Deno.env.get('APP_CRYPT_KEY'))
    console.log('🔐 [square-import-products] APP_CRYPT_KEY2 exists:', !!Deno.env.get('APP_CRYPT_KEY2'))

    const appCryptKey = Deno.env.get('APP_CRYPT_KEY2')
    if (!appCryptKey) {
      throw new Error('APP_CRYPT_KEY2 not configured')
    }

    console.log('🔐 Using encryption key: APP_CRYPT_KEY2')

    const { data: credentialsData, error: credentialsError } = await supabase.rpc('get_decrypted_credentials', {
      p_integration_id: integrationId,
      p_crypt_key: appCryptKey
    })

    if (credentialsError || !credentialsData) {
      throw new Error('Failed to retrieve credentials')
    }

    if (!Array.isArray(credentialsData) || credentialsData.length === 0) {
      console.error('No credentials found for integration:', integrationId)
      throw new Error('No credentials found for this integration')
    }

    const { access_token, environment } = credentialsData[0]

    const baseUrl = environment === 'SANDBOX' 
      ? 'https://connect.squareupsandbox.com' 
      : 'https://connect.squareup.com'

    let cursor: string | undefined = undefined
    let totalProcessed = 0
    let totalCreated = 0
    let totalUpdated = 0
    const errors: string[] = []
    let batchNumber = 0

    console.log(`🔄 Starting batch import process (baseUrl: ${baseUrl})`)

    // Import products in batches
    while (true) {
      batchNumber++
      console.log(`📦 Starting batch ${batchNumber} with cursor: ${cursor || 'initial'}`)
      
      try {
        // Check for cancellation before each batch (abort-aware)
        const { data: currentRun } = await supabase
          .from('product_import_runs')
          .select('status')
          .eq('id', runId)
          .single()

        if (currentRun?.status !== 'RUNNING') {
          console.log(`🛑 Import was cancelled (status: ${currentRun?.status}), exiting cleanly`)
          // Don't overwrite the status - it was set by the abort function
          return new Response(
            JSON.stringify({ 
              success: true,
              message: 'Import cancelled by user',
              run_id: runId,
              processed_count: totalProcessed,
              created_count: totalCreated,
              updated_count: totalUpdated
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          )
        }

        // Build query parameters
        const params = new URLSearchParams({
          types: 'ITEM,ITEM_VARIATION',
          limit: BATCH_SIZE.toString()
        })
        
        if (cursor) {
          params.append('cursor', cursor)
        }

        // Square API call with retry logic
        const response = await retrySquareApiCall(
          () => fetch(`${baseUrl}/v2/catalog/list?${params}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Square-Version': SQUARE_API_VERSION,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(30000) // 30 second timeout
          }),
          `Square API batch ${batchNumber}`
        )

        if (!response.ok) {
          const errorData = await response.text()
          throw new Error(`Square API error: ${response.status} - ${errorData}`)
        }

        const data = await response.json()
        const objects = data.objects || []

        if (objects.length === 0) {
          console.log('📄 No more data - ending batch processing')
          break // No more data
        }

        console.log(`📊 Processing ${objects.length} objects in batch ${batchNumber}`)

        // Process items and variations - filter out null/undefined objects
        const items = objects.filter((obj: any) => obj && obj.type === 'ITEM')
        const variations = objects.filter((obj: any) => obj && obj.type === 'ITEM_VARIATION')

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

        // Safe progress update after each batch
        await safeUpdateProgress(supabase, runId, {
          processed_count: totalProcessed,
          created_count: totalCreated,
          updated_count: totalUpdated,
          cursor: cursor
        }, `batch ${batchNumber}`)

        console.log(`✅ Completed batch ${batchNumber}: ${totalProcessed} total processed (+${totalCreated} created, +${totalUpdated} updated)`)

        if (!cursor) {
          console.log('🏁 No more pages - import complete')
          break // No more pages
        }

        // Brief delay between batches to prevent API rate limiting
        await sleep(200)

      } catch (batchError) {
        console.error(`❌ Batch ${batchNumber} processing error:`, batchError.message)
        errors.push(`Batch ${batchNumber} error: ${batchError.message}`)
        
        // For critical errors, stop processing
        if (batchError.message.includes('credentials') || 
            batchError.message.includes('authorization') ||
            batchError.message.includes('integration')) {
          console.log('🚨 Critical error detected - stopping import')
          break
        }
        
        // For other errors, continue with next batch
        console.log('⚠️ Non-critical error - continuing with next batch')
      }
    }

    // Finalize the import run (only if status is still RUNNING)
    const { data: finalRun } = await supabase
      .from('product_import_runs')
      .select('status')
      .eq('id', runId)
      .single()

    // Only update to SUCCESS/PARTIAL if the run wasn't manually aborted
    if (finalRun?.status === 'RUNNING') {
      const finalStatus = errors.length > 0 ? 'PARTIAL' : 'SUCCESS'
      
      await safeUpdateProgress(supabase, runId, {
        status: finalStatus,
        finished_at: new Date().toISOString(),
        processed_count: totalProcessed,
        created_count: totalCreated,
        updated_count: totalUpdated,
        errors: errors,
        cursor: null
      }, 'final status')

      console.log(`🎯 Import finalized with status: ${finalStatus}`)

      // Update integration success status
      await supabase
        .from('inventory_integrations')
        .update({
          last_success_at: new Date().toISOString(),
          last_error: errors.length > 0 ? errors[0] : null
        })
        .eq('id', integrationId)
    } else {
      console.log(`🛑 Import run was ${finalRun?.status} - not overwriting final status`)
    }

    console.log(`🏆 Import completed: ${totalProcessed} processed, ${totalCreated} created, ${totalUpdated} updated, ${errors.length} errors`)

    return new Response(
      JSON.stringify({ 
        success: true,
        run_id: runId,
        processed_count: totalProcessed,
        created_count: totalCreated,
        updated_count: totalUpdated,
        errors
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('💥 Import failed with unexpected error:', error.message)

    // Mark import run as failed if we have an ID
    if (runId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabase
          .from('product_import_runs')
          .update({
            status: 'FAILED',
            finished_at: new Date().toISOString(),
            errors: [`Unexpected crash during import: ${error.message}`]
          })
          .eq('id', runId)
          
        console.log(`🔧 Marked import run ${runId} as FAILED due to crash`)
      } catch (updateError) {
        console.error('❌ Failed to update import run status after crash:', updateError.message)
      }
    } else {
      console.error('❌ Critical: No runId available for crash cleanup')
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

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

    // Check if product already exists by POS link - fix null handling
    const { data: existingLink } = await supabase
      .from('product_pos_links')
      .select('product_id, products(*)')
      .eq('source', 'SQUARE')
      .eq('pos_item_id', item.id)
      .is('pos_variation_id', variation?.id || null)
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
          location_id: null
        })
    }

    return { created, updated }

  } catch (error) {
    console.error('Error processing product:', error)
    throw error
  }
}