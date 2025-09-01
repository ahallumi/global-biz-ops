// One-time cleanup function to fix retail price and barcode/UPC mapping
// This ensures existing products have proper barcode mirroring and investigates missing prices

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

interface CleanupResult {
  barcode_updates: number;
  missing_prices_found: number;
  details: Array<{
    product_id: string;
    name: string;
    action: 'barcode_mirrored' | 'missing_price_detected';
    upc?: string;
    has_pos_link?: boolean;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🧹 Starting product data cleanup...");
    
    const result: CleanupResult = {
      barcode_updates: 0,
      missing_prices_found: 0,
      details: []
    };

    // Phase 1: Mirror UPC to barcode where barcode is empty
    console.log("📋 Phase 1: Mirroring UPC to barcode for empty barcodes...");
    
    const { data: productsWithEmptyBarcode, error: queryError } = await supabaseAdmin
      .from('products')
      .select('id, name, upc, barcode')
      .not('upc', 'is', null)
      .or('barcode.is.null,barcode.eq.');
    
    if (queryError) {
      throw new Error(`Failed to query products: ${queryError.message}`);
    }

    console.log(`Found ${productsWithEmptyBarcode?.length || 0} products with UPC but empty barcode`);

    for (const product of productsWithEmptyBarcode || []) {
      if (product.upc && (!product.barcode || product.barcode === '')) {
        const { error: updateError } = await supabaseAdmin
          .from('products')
          .update({ barcode: product.upc })
          .eq('id', product.id);
        
        if (updateError) {
          console.error(`Failed to update barcode for product ${product.id}:`, updateError);
        } else {
          console.log(`✅ Mirrored UPC to barcode for product: ${product.name} (UPC: ${product.upc})`);
          result.barcode_updates++;
          result.details.push({
            product_id: product.id,
            name: product.name,
            action: 'barcode_mirrored',
            upc: product.upc
          });
        }
      }
    }

    // Phase 2: Find products with missing retail prices that have Square POS links
    console.log("💰 Phase 2: Investigating products with missing retail prices...");
    
    const { data: productsWithMissingPrices, error: priceQueryError } = await supabaseAdmin
      .from('products')
      .select(`
        id, 
        name, 
        retail_price_cents,
        product_pos_links!inner (
          pos_item_id,
          pos_variation_id,
          source
        )
      `)
      .eq('product_pos_links.source', 'SQUARE')
      .is('retail_price_cents', null);
    
    if (priceQueryError) {
      throw new Error(`Failed to query products with missing prices: ${priceQueryError.message}`);
    }

    console.log(`Found ${productsWithMissingPrices?.length || 0} Square-linked products with missing retail prices`);

    for (const product of productsWithMissingPrices || []) {
      console.log(`⚠️ Missing price: ${product.name} (ID: ${product.id})`);
      result.missing_prices_found++;
      result.details.push({
        product_id: product.id,
        name: product.name,
        action: 'missing_price_detected',
        has_pos_link: true
      });
    }

    // Phase 3: Create validation queries for future use
    console.log("📊 Phase 3: Running validation queries...");
    
    // Count products with UPC but empty barcode (should be 0 after cleanup)
    const { count: emptyBarcodeCount } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .not('upc', 'is', null)
      .or('barcode.is.null,barcode.eq.');

    // Count Square-linked products with missing prices
    const { count: missingPriceCount } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_pos_links!inner (source)
      `, { count: 'exact', head: true })
      .eq('product_pos_links.source', 'SQUARE')
      .is('retail_price_cents', null);

    console.log(`📈 Cleanup Summary:`);
    console.log(`   • Barcode updates applied: ${result.barcode_updates}`);
    console.log(`   • Missing prices found: ${result.missing_prices_found}`);
    console.log(`   • Products with UPC but empty barcode remaining: ${emptyBarcodeCount || 0}`);
    console.log(`   • Square-linked products with missing prices: ${missingPriceCount || 0}`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        barcode_updates: result.barcode_updates,
        missing_prices_found: result.missing_prices_found,
        empty_barcodes_remaining: emptyBarcodeCount || 0,
        square_products_missing_prices: missingPriceCount || 0
      },
      details: result.details,
      recommendations: [
        result.barcode_updates > 0 ? "Barcode mirroring completed successfully" : "No barcode updates needed",
        result.missing_prices_found > 0 ? `${result.missing_prices_found} products missing retail prices - review Square catalog data` : "All Square products have retail prices",
        "Run a new Square import to verify price extraction works correctly",
        "Check logs during import for 'priceSource' values to understand price extraction"
      ]
    }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders }
    });

  } catch (e) {
    console.error("Cleanup failed:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : String(e)
    }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders }
    });
  }
});