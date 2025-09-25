import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  integrationId: string;
}

interface BackfillResult {
  matched_count: number;
  details: Array<{
    product_id: string;
    pos_item_id: string;
    pos_variation_id: string | null;
    match_method: 'UPC' | 'SKU';
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { integrationId }: BackfillRequest = await req.json();
    
    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    console.log(`🔍 Starting POS links backfill for integration: ${integrationId}`);

    const result: BackfillResult = {
      matched_count: 0,
      details: []
    };

    // Find products without POS links that have UPC or SKU
    const { data: unlinkProducts, error: unlinkError } = await supabaseClient
      .from('products')
      .select('id, name, upc, sku')
      .not('upc', 'is', null)
      .not('sku', 'is', null)
      .not('id', 'in', supabaseClient
        .from('product_pos_links')
        .select('product_id')
        .eq('integration_id', integrationId)
        .eq('source', 'SQUARE')
      );

    if (unlinkError) {
      throw new Error(`Failed to fetch unlinked products: ${unlinkError.message}`);
    }

    console.log(`📋 Found ${unlinkProducts?.length || 0} products without POS links`);

    // For each unlinked product, try to find matching Square items by UPC/SKU
    for (const product of unlinkProducts || []) {
      try {
        // Try UPC match first
        if (product.upc) {
          const { data: upcMatches, error: upcError } = await supabaseClient
            .from('v_product_pos_identity')
            .select('pos_item_id, pos_variation_id, product_id')
            .eq('integration_id', integrationId)
            .eq('source', 'SQUARE')
            .eq('upc', product.upc)
            .neq('product_id', product.id); // Don't match self

          if (!upcError && upcMatches && upcMatches.length > 0) {
            const match = upcMatches[0];
            
            // Create POS link for this product
            const { error: linkError } = await supabaseClient
              .from('product_pos_links')
              .insert({
                product_id: product.id,
                integration_id: integrationId,
                source: 'SQUARE',
                pos_item_id: match.pos_item_id,
                pos_variation_id: match.pos_variation_id
              });

            if (!linkError) {
              result.matched_count++;
              result.details.push({
                product_id: product.id,
                pos_item_id: match.pos_item_id,
                pos_variation_id: match.pos_variation_id,
                match_method: 'UPC'
              });
              console.log(`✅ UPC matched: ${product.name} -> ${match.pos_item_id}`);
              continue;
            } else {
              console.log(`⚠️ Failed to create UPC link for ${product.name}: ${linkError.message}`);
            }
          }
        }

        // Try SKU match if UPC didn't work
        if (product.sku) {
          const { data: skuMatches, error: skuError } = await supabaseClient
            .from('v_product_pos_identity')
            .select('pos_item_id, pos_variation_id, product_id')
            .eq('integration_id', integrationId)
            .eq('source', 'SQUARE')
            .eq('sku', product.sku)
            .neq('product_id', product.id); // Don't match self

          if (!skuError && skuMatches && skuMatches.length > 0) {
            const match = skuMatches[0];
            
            // Create POS link for this product
            const { error: linkError } = await supabaseClient
              .from('product_pos_links')
              .insert({
                product_id: product.id,
                integration_id: integrationId,
                source: 'SQUARE',
                pos_item_id: match.pos_item_id,
                pos_variation_id: match.pos_variation_id
              });

            if (!linkError) {
              result.matched_count++;
              result.details.push({
                product_id: product.id,
                pos_item_id: match.pos_item_id,
                pos_variation_id: match.pos_variation_id,
                match_method: 'SKU'
              });
              console.log(`✅ SKU matched: ${product.name} -> ${match.pos_item_id}`);
            } else {
              console.log(`⚠️ Failed to create SKU link for ${product.name}: ${linkError.message}`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error processing product ${product.name}:`, error);
      }
    }

    console.log(`🎉 Backfill complete: ${result.matched_count} links created`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Backfill failed:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error',
      matched_count: 0,
      details: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});