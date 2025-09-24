import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductResult {
  id: string;
  name: string;
  sku: string | null;
  upc: string | null;
  barcode: string | null;
  price: number | null;
  size: string | null;
  unit: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { q: query } = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ products: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Searching products for query:', query);

    // Search products with prioritized exact matches
    const { data: products, error } = await supabaseClient
      .from('products')
      .select('id, name, sku, upc, barcode, retail_price_cents, size, unit_of_sale')
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%,upc.eq.${query},barcode.eq.${query}`)
      .eq('catalog_status', 'ACTIVE')
      .limit(20);

    if (error) {
      console.error('Error searching products:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform and prioritize results
    const transformedProducts: ProductResult[] = (products || []).map(product => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      upc: product.upc,
      barcode: product.barcode,
      price: product.retail_price_cents ? product.retail_price_cents / 100 : null,
      size: product.size,
      unit: product.unit_of_sale || 'EACH'
    }));

    // Sort by relevance: exact barcode/UPC matches first, then name matches
    const sortedProducts = transformedProducts.sort((a, b) => {
      const queryLower = query.toLowerCase();
      
      // Exact barcode/UPC matches first
      const aExactMatch = (a.barcode === query) || (a.upc === query);
      const bExactMatch = (b.barcode === query) || (b.upc === query);
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // Then by name alphabetically
      return a.name.localeCompare(b.name);
    });

    console.log(`Found ${sortedProducts.length} products`);

    return new Response(JSON.stringify({ products: sortedProducts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-products function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});