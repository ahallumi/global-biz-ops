import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushProductsRequest {
  productIds?: string[];
  syncState?: 'LOCAL_ONLY' | 'DIVERGED';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { productIds, syncState = 'LOCAL_ONLY' }: PushProductsRequest = await req.json();

    console.log('Push products request:', { productIds, syncState });

    // Create a sync run record
    const { data: syncRun, error: syncRunError } = await supabaseClient
      .from('product_sync_runs')
      .insert({
        direction: 'OUT',
        status: 'PENDING',
        created_by: (await supabaseClient.auth.getUser()).data.user?.id
      })
      .select()
      .single();

    if (syncRunError) {
      console.error('Error creating sync run:', syncRunError);
      throw syncRunError;
    }

    console.log('Created sync run:', syncRun.id);

    // Get products to push
    let query = supabaseClient
      .from('products')
      .select('*');

    if (productIds && productIds.length > 0) {
      query = query.in('id', productIds);
    } else {
      query = query.eq('sync_state', syncState);
    }

    const { data: products, error: productsError } = await query;

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw productsError;
    }

    if (!products || products.length === 0) {
      await supabaseClient
        .from('product_sync_runs')
        .update({
          status: 'COMPLETED',
          finished_at: new Date().toISOString(),
          processed_count: 0
        })
        .eq('id', syncRun.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No products to push',
          processed_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${products.length} products to push`);

    // Get Square credentials
    const { data: integrations, error: integrationsError } = await supabaseClient
      .from('inventory_integrations')
      .select('*')
      .eq('provider', 'SQUARE')
      .single();

    if (integrationsError || !integrations) {
      throw new Error('Square integration not found');
    }

    // Get decrypted credentials
    const cryptKey = Deno.env.get('APP_CRYPT_KEY2');
    if (!cryptKey) {
      throw new Error('APP_CRYPT_KEY2 not configured');
    }

    const { data: credentials, error: credentialsError } = await supabaseClient
      .rpc('get_decrypted_credentials', {
        p_integration_id: integrations.id,
        p_crypt_key: cryptKey
      });

    if (credentialsError) {
      console.error('RPC credentials error:', credentialsError);
      throw new Error(`Failed to retrieve credentials: ${credentialsError.message}`);
    }

    if (!credentials || !Array.isArray(credentials) || credentials.length === 0 || !credentials[0]?.access_token) {
      throw new Error('No access token found for this integration. Please check your Square credentials.');
    }

    console.log('Successfully retrieved Square credentials');
    const accessToken = credentials[0].access_token;
    const environment = credentials[0].environment;
    const baseUrl = environment === 'PRODUCTION' 
      ? 'https://connect.squareup.com' 
      : 'https://connect.squareupsandbox.com';

    console.log(`Using Square ${environment} environment`);

    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    const errors: any[] = [];

    // Process each product
    for (const product of products) {
      try {
        console.log(`Processing product: ${product.name} (${product.id})`);

        // Check if product already has Square mapping
        const { data: existingLinks } = await supabaseClient
          .from('product_pos_links')
          .select('*')
          .eq('product_id', product.id)
          .eq('source', 'SQUARE');

        const hasSquareLink = existingLinks && existingLinks.length > 0;

        if (hasSquareLink) {
          // Update existing Square item
          const link = existingLinks[0];
          
          const updatePayload = {
            type: 'ITEM',
            id: link.pos_item_id,
            item_data: {
              name: product.name,
              variations: [{
                type: 'ITEM_VARIATION',
                id: link.pos_variation_id,
                item_variation_data: {
                  name: product.name,
                  pricing_type: 'FIXED_PRICING',
                  price_money: product.retail_price_cents ? {
                    amount: product.retail_price_cents,
                    currency: 'USD'
                  } : undefined,
                  track_inventory: true
                }
              }]
            }
          };

          const updateResponse = await fetch(`${baseUrl}/v2/catalog/object`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              idempotency_key: `update-${product.id}-${Date.now()}`,
              object: updatePayload
            })
          });

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Square API error: ${updateResponse.status} ${errorText}`);
          }

          updatedCount++;
        } else {
          // Create new Square item
          const createPayload = {
            type: 'ITEM',
            id: `#${product.id}`, // Temporary ID for creation
            item_data: {
              name: product.name,
              description: product.size ? `Size: ${product.size}` : undefined,
              category_id: undefined, // Could map categories later
              variations: [{
                type: 'ITEM_VARIATION',
                id: `#${product.id}-variation`,
                item_variation_data: {
                  name: product.name,
                  pricing_type: 'FIXED_PRICING',
                  price_money: product.retail_price_cents ? {
                    amount: product.retail_price_cents,
                    currency: 'USD'
                  } : undefined,
                  track_inventory: true
                }
              }]
            }
          };

          const createResponse = await fetch(`${baseUrl}/v2/catalog/object`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              idempotency_key: `create-${product.id}-${Date.now()}`,
              object: createPayload
            })
          });

          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Square API error: ${createResponse.status} ${errorText}`);
          }

          const createResult = await createResponse.json();
          const createdItem = createResult.catalog_object;
          const createdVariation = createdItem.item_data.variations[0];

          // Save the Square IDs to our database
          await supabaseClient
            .from('product_pos_links')
            .insert({
              product_id: product.id,
              source: 'SQUARE',
              pos_item_id: createdItem.id,
              pos_variation_id: createdVariation.id
            });

          createdCount++;
        }

        // Update product sync state
        await supabaseClient
          .from('products')
          .update({
            sync_state: 'SYNCED',
            origin: product.origin === 'LOCAL' ? 'MERGED' : product.origin
          })
          .eq('id', product.id);

        processedCount++;
        console.log(`Successfully processed product: ${product.name}`);

      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        errors.push({
          product_id: product.id,
          product_name: product.name,
          error: error.message
        });
      }
    }

    // Update sync run with results
    await supabaseClient
      .from('product_sync_runs')
      .update({
        status: errors.length === products.length ? 'FAILED' : 'COMPLETED',
        finished_at: new Date().toISOString(),
        processed_count: processedCount,
        created_count: createdCount,
        updated_count: updatedCount,
        errors: errors
      })
      .eq('id', syncRun.id);

    console.log('Push completed:', {
      processed: processedCount,
      created: createdCount,
      updated: updatedCount,
      errors: errors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        sync_run_id: syncRun.id,
        processed_count: processedCount,
        created_count: createdCount,
        updated_count: updatedCount,
        errors: errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in square-push-products:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});