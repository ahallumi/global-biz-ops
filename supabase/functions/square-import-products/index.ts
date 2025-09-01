// Variation-aware Square Import Function
// This implements the two-pass approach to fix the "0 processed items" issue

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMPORT_MAX_SECONDS = Number(Deno.env.get("IMPORT_MAX_SECONDS") ?? 50);
const IMPORT_PAGE_SIZE = Number(Deno.env.get("IMPORT_PAGE_SIZE") ?? 100);

// Dynamic Square API base resolution
function resolveSquareBase(environment?: string | null): string {
  const env = (environment || "").toLowerCase();
  if (env === "sandbox" || env === "test") return "https://connect.squareupsandbox.com/v2";
  return "https://connect.squareup.com/v2"; // production default
}

class SearchNotSupportedError extends Error { 
  code = "SEARCH_NOT_SUPPORTED"; 
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Mode = "START" | "RESUME" | "CONTINUE";

interface StartBody {
  integrationId: string;
  mode?: Mode;
  runId?: string;
}

interface SquareSearchResponse {
  objects?: any[];
  related_objects?: any[];
  cursor?: string;
}

// Enhanced error structure with context
interface ImportError {
  timestamp: string;
  code: string;
  message: string;
  context?: {
    op?: string;
    table?: string;
    sq_item_id?: string;
    sq_variation_id?: string;
    product_id?: string;
    upc?: string;
    sku?: string;
    detail?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as StartBody;
    // Normalize mode - treat undefined, "FULL", or unknown modes as "START"  
    const mode: Mode = body.mode === "RESUME" || body.mode === "CONTINUE" ? body.mode : "START";
    console.log("Normalized mode:", mode, "from original:", body.mode);

    if (!body.integrationId) return json({ error: "integrationId required" }, 400);

    if (mode === "START") {
      const active = await getActiveRun(body.integrationId);
      if (active) return json({ error: "Import already in progress", runId: active.id }, 409);

      const runId = await createRun(body.integrationId);

      // Kickstart enhancement: immediately transition to RUNNING with preflight
      await updateRun(runId, { status: "RUNNING" });

      try {
        const creds = await getSquareCreds(body.integrationId);
        const who = await squareWhoAmI(creds.accessToken, creds.baseUrl);
        await appendError(runId, "INFO", `Square merchant: ${who.merchantId} (${who.businessName || "?"}) @ ${creds.baseUrl} (${creds.environment || 'production'})`);

        // Test catalog access first
        await testCatalogAccess(creds.accessToken, creds.baseUrl);

        // First page fetch to kickstart and avoid "PENDING forever"
        let first: SquareSearchResponse;
        try {
          first = await searchCatalog(creds.accessToken, creds.baseUrl, undefined);
        } catch (e) {
          if (e instanceof SearchNotSupportedError) {
            await appendError(runId, "FALLBACK", "Using list catalog due to search not supported");
            first = await listCatalog(creds.accessToken, creds.baseUrl, undefined);
          } else {
            throw e;
          }
        }
        const processed = (first.objects?.length || 0) + (first.related_objects?.length || 0);

        await updateRun(runId, {
          cursor: first.cursor ?? null,
          processed_count: processed,
          status: "RUNNING", // Always RUNNING, never SUCCESS in START
          finished_at: null,  // Never set finished_at in START
        });

        // Always invoke CONTINUE to run processing pass, even if no cursor
        console.log(`Kickstart done; invoking CONTINUE (cursor: ${first.cursor ? 'present' : 'none'})`);
        await selfInvoke({ integrationId: body.integrationId, mode: "CONTINUE", runId });

        return json({ ok: true, runId, kickstarted: true, processed });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        await appendError(runId, "KICKSTART", errorMessage);
        await updateRun(runId, { status: "FAILED", finished_at: new Date().toISOString() });
        await updateIntegrationLastError(body.integrationId, errorMessage);
        return json({ error: errorMessage, runId }, 500);
      }
    }

    if (mode === "RESUME") {
      if (!body.runId) return json({ error: "runId required for RESUME" }, 400);
      const run = await getRun(body.runId);
      if (!run) return json({ error: "run not found" }, 404);
      if (run.status !== "PARTIAL") return json({ error: `cannot resume run in status ${run.status}` }, 400);
      await selfInvoke({ integrationId: body.integrationId, mode: "CONTINUE", runId: body.runId });
      return json({ ok: true, runId: body.runId });
    }

    if (mode === "CONTINUE") {
      if (!body.runId) return json({ error: "runId required for CONTINUE" }, 400);
      const result = await performImport(body.integrationId, body.runId);
      return json(result);
    }

    return json({ error: "invalid mode" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...corsHeaders } });
}

async function getActiveRun(integrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("product_import_runs")
    .select("id, status")
    .eq("integration_id", integrationId)
    .in("status", ["RUNNING","PENDING","PARTIAL"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createRun(integrationId: string) {
  const { data, error } = await supabaseAdmin
    .from("product_import_runs")
    .insert({ integration_id: integrationId, status: "PENDING" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function getRun(runId: string) {
  const { data, error } = await supabaseAdmin
    .from("product_import_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

async function updateRun(runId: string, patch: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("product_import_runs")
    .update({ ...patch, last_progress_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw error;
}

async function appendError(runId: string, code: string, detail: string, context?: object) {
  try {
    const errorEntry: ImportError = {
      timestamp: new Date().toISOString(),
      code,
      message: detail,
      ...(context && { context })
    };

    // Get current errors and implement capping
    const { data: run } = await supabaseAdmin
      .from('product_import_runs')
      .select('errors')
      .eq('id', runId)
      .single();

    let currentErrors = (run?.errors as ImportError[]) || [];
    
    // Cap at 500 errors, then add summary
    if (currentErrors.length >= 500) {
      const lastError = currentErrors[currentErrors.length - 1];
      if (lastError.code !== 'ERROR_CAP_REACHED') {
        currentErrors[499] = {
          timestamp: new Date().toISOString(),
          code: 'ERROR_CAP_REACHED',
          message: `Error limit reached. ${currentErrors.length} total errors. Last error: ${code}`,
          context: { detail: 'Additional errors will be suppressed' }
        };
      }
      return; // Don't add more errors after cap
    }

    currentErrors.push(errorEntry);

    const { error } = await supabaseAdmin
      .from('product_import_runs')
      .update({ errors: currentErrors })
      .eq('id', runId);

    if (error) {
      console.error(`Failed to append error to run ${runId}:`, error);
    }
  } catch (e) {
    console.error(`Error appending to run ${runId}:`, e);
  }
}

async function selfInvoke(payload: StartBody) {
  const url = new URL("/functions/v1/square-import-products", SUPABASE_URL).toString();
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
}

async function getSquareCreds(integrationId: string): Promise<{ accessToken: string; environment: string | null; baseUrl: string }> {
  try {
    const cryptKey = Deno.env.get("APP_CRYPT_KEY2");
    if (!cryptKey) {
      throw new Error("APP_CRYPT_KEY2 not configured");
    }
    
    const { data, error } = await supabaseAdmin.rpc("get_decrypted_credentials", { 
      p_integration_id: integrationId,
      p_crypt_key: cryptKey
    });
    
    if (error) {
      console.error("RPC credentials error:", error);
      throw new Error(`Failed to retrieve credentials: ${error.message || error}`);
    }
    
    // The RPC function returns an array of records
    if (!data || !Array.isArray(data) || data.length === 0 || !data[0]?.access_token) {
      throw new Error("No access token found for this integration. Please check your Square credentials.");
    }
    
    const accessToken = data[0].access_token as string;
    const environment = data[0].environment as string | null;
    const baseUrl = resolveSquareBase(environment);
    
    console.log(`Successfully retrieved Square credentials for ${environment || 'production'} environment`);
    return { accessToken, environment, baseUrl };
  } catch (e) {
    console.error("getSquareCreds failed:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Square credentials error: ${errorMessage}`);
  }
}

async function squareWhoAmI(accessToken: string, baseUrl: string) {
  const resp = await fetch(`${baseUrl}/merchants/me`, {
    headers: { 
      Authorization: `Bearer ${accessToken}`, 
      Accept: "application/json",
      "Square-Version": "2023-10-18"
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Square whoami failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const m = data.merchant || data.merchants?.[0] || {};
  return { merchantId: m.id, businessName: m.business_name, country: m.country }; 
}

async function testCatalogAccess(accessToken: string, baseUrl: string): Promise<void> {
  console.log("🔍 Testing catalog access with /v2/catalog/list endpoint...");
  const url = `${baseUrl}/catalog/list`;
  
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Square-Version": "2023-10-18"
    },
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    
    if (resp.status === 404) {
      throw new Error(`Catalog access denied (404): This usually means your Square application lacks the 'ITEMS_READ' permission scope. Please check your Square app configuration. Response: ${text}`);
    } else if (resp.status === 403) {
      throw new Error(`Catalog access forbidden (403): Check your Square app permissions and environment. Response: ${text}`);
    } else if (resp.status === 401) {
      throw new Error(`Authentication failed (401): Check your Square access token. Response: ${text}`);
    } else {
      throw new Error(`Catalog access test failed: ${resp.status} ${text}`);
    }
  }
  
  const result = await resp.json();
  console.log(`✅ Catalog access test passed. Found ${result.objects?.length || 0} catalog objects.`);
}

async function searchCatalog(accessToken: string, baseUrl: string, cursor?: string): Promise<SquareSearchResponse> {
  const url = `${baseUrl}/catalog/search-catalog-objects`;
  const body: any = {
    object_types: ["ITEM"],
    include_related_objects: true,
    limit: IMPORT_PAGE_SIZE,
  };
  if (cursor) body.cursor = cursor;

  let attempt = 0;
  while (true) {
    attempt++;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Square-Version": "2023-10-18"
      },
      body: JSON.stringify(body),
    });
    
    if (resp.status === 429 || resp.status >= 500) {
      await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
      continue;
    }
    
    if (!resp.ok) {
      const text = await resp.text();
      
      // Treat 404 as search not supported for automatic fallback
      if (resp.status === 404) {
        throw new SearchNotSupportedError("search-catalog-objects returned 404 NOT_FOUND");
      } else if (resp.status === 403) {
        throw new Error(`Square catalog search forbidden (403): Check your Square app permissions for catalog access. Response: ${text}`);
      } else if (resp.status === 401) {
        throw new Error(`Square catalog search authentication failed (401): Check your access token validity. Response: ${text}`);
      } else {
        throw new Error(`Square searchCatalog failed: ${resp.status} ${text}`);
      }
    }
    
    const result = await resp.json();
    return {
      objects: result.objects ?? [],
      related_objects: result.related_objects ?? [],
      cursor: result.cursor
    };
  }
}

async function listCatalog(accessToken: string, baseUrl: string, cursor?: string): Promise<SquareSearchResponse> {
  const url = new URL(`${baseUrl}/catalog/list`);
  url.searchParams.set("types", "ITEM,ITEM_VARIATION");
  url.searchParams.set("limit", String(IMPORT_PAGE_SIZE));
  if (cursor) url.searchParams.set("cursor", cursor);

  let attempt = 0;
  while (true) {
    attempt++;
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Square-Version": "2023-10-18"
      },
    });
    
    if (resp.status === 429 || resp.status >= 500) {
      await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
      continue;
    }
    
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Square listCatalog failed: ${resp.status} ${text}`);
    }
    
    const result = await resp.json();
    
    // Separate items and variations for list endpoint
    const objects = (result.objects || []).filter((obj: any) => obj.type === "ITEM");
    const related_objects = (result.objects || []).filter((obj: any) => obj.type === "ITEM_VARIATION");
    
    return {
      objects,
      related_objects,
      cursor: result.cursor
    };
  }
}

async function performImport(integrationId: string, runId: string) {
  const started = Date.now();

  try {
    const run = await getRun(runId);
    if (!run) throw new Error("run not found");
    if (run.status === "FAILED" || run.status === "SUCCESS") return { ok: true, done: true };
    if (run.status !== "RUNNING") await updateRun(runId, { status: "RUNNING" });

    // Get access token and verify merchant
    let creds: { accessToken: string; environment: string | null; baseUrl: string };
    try {
      creds = await getSquareCreds(integrationId);
      const who = await squareWhoAmI(creds.accessToken, creds.baseUrl);
      await appendError(runId, "INFO", `Square merchant: ${who.merchantId} (${who.businessName || "?"}) @ ${creds.baseUrl} (${creds.environment || 'production'})`);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      await appendError(runId, "CREDENTIALS", errorMessage);
      await updateRun(runId, { status: "FAILED", finished_at: new Date().toISOString() });
      await updateIntegrationLastError(integrationId, errorMessage);
      return { ok: false, error: errorMessage };
    }

    // Continue from checkpoint
    let cursor: string | undefined = run.cursor ?? undefined;
    let processed = run.processed_count ?? 0;

    // Collection maps for two-pass approach
    const itemMap = new Map<string, any>();
    const variationMap = new Map<string, any[]>(); // Group variations by parent item ID
    let useListFallback = false;

    console.log("🔄 Starting Collection Pass...");
    
    // Test catalog access first
    try {
      await testCatalogAccess(creds.accessToken, creds.baseUrl);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      await appendError(runId, "CATALOG_ACCESS", errorMessage);
      await updateRun(runId, { status: "FAILED", finished_at: new Date().toISOString() });
      await updateIntegrationLastError(integrationId, errorMessage);
      return { ok: false, error: errorMessage };
    }
    
    // PHASE 1: Collection Pass - gather all items and variations
    while (true) {
      const fresh = await getRun(runId);
      if (fresh?.status === "FAILED") {
        return { ok: false, aborted: true };
      }

      let page: SquareSearchResponse;
      
      try {
        if (useListFallback) {
          page = await listCatalog(creds.accessToken, creds.baseUrl, cursor);
        } else {
          page = await searchCatalog(creds.accessToken, creds.baseUrl, cursor);
        }
      } catch (e) {
        if (e instanceof SearchNotSupportedError && !useListFallback) {
          console.log("🔄 Search not supported, falling back to list catalog...");
          await appendError(runId, "FALLBACK", "Switching from search to list catalog due to 404 NOT_FOUND");
          useListFallback = true;
          page = await listCatalog(creds.accessToken, creds.baseUrl, cursor);
        } else {
          throw e;
        }
      }

      const items = page.objects || [];
      const related = page.related_objects || [];

      // Accumulate in memory
      for (const item of items) itemMap.set(item.id, item);
      for (const variation of related) {
        if (variation.type === "ITEM_VARIATION") {
          // Group variations by their parent item ID
          const parentItemId = variation.item_variation_data?.item_id;
          if (parentItemId) {
            if (!variationMap.has(parentItemId)) {
              variationMap.set(parentItemId, []);
            }
            variationMap.get(parentItemId)!.push(variation);
          }
        }
      }

      processed += items.length + related.length;

      // Update progress
      cursor = page.cursor;
      await updateRun(runId, {
        cursor: cursor ?? null,
        processed_count: processed,
      });

      // Yield if time budget exceeded
      const elapsed = (Date.now() - started) / 1000;
      if (elapsed > IMPORT_MAX_SECONDS - 5) {
        await updateRun(runId, { status: cursor ? "PARTIAL" : "RUNNING" });
        if (cursor) await selfInvoke({ integrationId, mode: "CONTINUE", runId });
        return { ok: true, yielded: Boolean(cursor), processed };
      }

      if (!cursor) break; // Collection complete
    }

    const itemCount = itemMap.size;
    const variationCount = variationMap.size;
    console.log(`📦 Collection complete: ${itemCount} items, ${variationCount} variations`);

    // Check for empty catalog
    if (itemCount === 0) {
      await appendError(runId, "EMPTY_CATALOG", "No items found in Square catalog. Check permissions or environment.");
      await updateRun(runId, { status: "SUCCESS", finished_at: new Date().toISOString() });
      await updateIntegrationLastError(integrationId, "Empty catalog - no items found");
      return { ok: true, done: true, processed, created: 0, updated: 0 };
    }

    console.log("⚙️ Starting Processing Pass...");
    
    // Phase 2: Processing pass - merge items with variations and upsert
    console.log(`📊 Processing ${itemCount} items with ${variationCount} variations...`);
    
    // Track currency information for safety
    const currencyTracker = new Map<string, number>();
    
    const mergedProducts = [];
    for (const [itemId, item] of itemMap) {
      const variations = variationMap.get(itemId) || [];
      
      if (variations.length === 0) {
        // Item without variations - create a single product
        mergedProducts.push({
          item,
          variation: null,
          isStandaloneItem: true
        });
      } else {
        // Item with variations - create products for each variation
        for (const variation of variations) {
          // Track currency from price_money
          if (variation.item_variation_data?.price_money?.currency) {
            const currency = variation.item_variation_data.price_money.currency;
            currencyTracker.set(currency, (currencyTracker.get(currency) || 0) + 1);
          }
          
          mergedProducts.push({
            item,
            variation,
            isStandaloneItem: false
          });
        }
      }
    }

    // Log currency information for safety
    if (currencyTracker.size > 1) {
      console.warn(`⚠️ Multiple currencies detected:`, Array.from(currencyTracker.entries()));
      await appendError(runId, 'MIXED_CURRENCIES', 
        `Multiple currencies found: ${Array.from(currencyTracker.keys()).join(', ')}`,
        { currencies: Array.from(currencyTracker.entries()) }
      );
    } else if (currencyTracker.size === 1) {
      console.log(`💰 All items use currency: ${Array.from(currencyTracker.keys())[0]}`);
    }

    console.log(`🔗 Created ${mergedProducts.length} product entries for processing`);
    
    await upsertItemsWithVariations(
      integrationId,
      runId,
      mergedProducts
    );

    const finalRun = await getRun(runId);
    const createdCount = finalRun?.created_count || 0;
    const updatedCount = finalRun?.updated_count || 0;
    const failedCount = finalRun?.failed_count || 0;

    const finalStatus = failedCount > 0 && createdCount === 0 && updatedCount === 0 ? "FAILED" : "SUCCESS";
    
    await updateRun(runId, {
      status: finalStatus,
      finished_at: new Date().toISOString(),
    });

    await updateIntegrationLastError(integrationId, null);
    console.log(`✅ Import completed: ${createdCount} created, ${updatedCount} updated, ${failedCount} failed`);
    return { ok: true, done: true, processed, created: createdCount, updated: updatedCount, failed: failedCount };

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    await appendError(runId, "FATAL", errorMessage);
    await updateRun(runId, { status: "FAILED", finished_at: new Date().toISOString() });
    await updateIntegrationLastError(integrationId, errorMessage);
    return { ok: false, error: errorMessage };
  }
}

async function updateIntegrationLastError(integrationId: string, msg: string | null) {
  const { error } = await supabaseAdmin
    .from("inventory_integrations")
    .update({ last_error: msg })
    .eq("id", integrationId);
  if (error) console.error("updateIntegrationLastError", error);
}

async function upsertItemsWithVariations(
  integrationId: string,
  runId: string,
  mergedProducts: Array<{ item: any; variation: any; isStandaloneItem: boolean }>
) {
  let processedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  
  for (const merged of mergedProducts) {
    try {
      const result = await upsertSingleProduct(supabaseAdmin, integrationId, runId, merged);
      processedCount++;
      
      if (result.created) createdCount++;
      if (result.updated) updatedCount++;
      
      // Update progress every 50 items for better performance
      if (processedCount % 50 === 0 || processedCount === mergedProducts.length) {
        const { error: progressError } = await supabaseAdmin
          .from('product_import_runs')
          .update({ 
            processed_count: processedCount,
            created_count: createdCount,
            updated_count: updatedCount,
            failed_count: failedCount,
            last_progress_at: new Date().toISOString()
          })
          .eq('id', runId);
          
        if (progressError) {
          console.error('Failed to update progress:', progressError);
        } else {
          console.log(`📈 Progress: ${processedCount}/${mergedProducts.length} (${createdCount} created, ${updatedCount} updated, ${failedCount} failed)`);
        }
      }
    } catch (error) {
      console.error(`Failed to process item:`, error);
      failedCount++; // Increment failed count for actual processing failures
      await appendError(runId, 'UPSERT_FAILED', `Failed to upsert product: ${error.message}`, {
        op: 'upsert_product',
        sq_item_id: merged.item?.id,
        sq_variation_id: merged.variation?.id,
        detail: error.message
      });
    }
  }
}

async function upsertSingleProduct(
  supabase: any,
  integrationId: string,
  runId: string,
  merged: { item: any; variation: any; isStandaloneItem: boolean }
): Promise<{ created: boolean; updated: boolean; productId?: string }> {
  const { item, variation } = merged;
  
  // Extract basic product info
  const productName = variation?.item_variation_data?.name || item?.item_data?.name || "Unnamed Item";
  const sku = variation?.item_variation_data?.sku || item?.item_data?.sku || null;
  const upc = variation?.item_variation_data?.upc || item?.item_data?.upc || null;
  
  // Extract Square IDs
  const squareItemId = item?.id;
  const squareVariationId = variation?.id || null;
  
  if (!squareItemId) {
    throw new Error("Square item ID is missing");
  }

  // Extract price and currency (prefer variation price, fallback to item price)
  let priceCents: number | null = null;
  let currencyCode = 'USD'; // Default fallback
  if (variation?.item_variation_data?.price_money?.amount) {
    priceCents = parseInt(variation.item_variation_data.price_money.amount, 10);
    currencyCode = variation.item_variation_data.price_money.currency || 'USD';
  } else if (item.item_data?.variations?.[0]?.item_variation_data?.price_money?.amount) {
    priceCents = parseInt(item.item_data.variations[0].item_variation_data.price_money.amount, 10);
    currencyCode = item.item_data.variations[0].item_variation_data.price_money.currency || 'USD';
  }

  // Step 1: Look for existing link by Square item ID (scoped to integration)
  let existingProductId: string | null = null;
  
  const { data: linkData, error: linkError } = await supabase
    .from('product_pos_links')
    .select('product_id')
    .eq('integration_id', integrationId)
    .eq('pos_item_id', squareItemId)
    .eq('pos_variation_id', squareVariationId)
    .maybeSingle();
  
  if (linkError) {
    console.error('Error looking up existing link:', linkError);
    await appendError(runId, 'LINK_LOOKUP_FAILED', `Failed to lookup existing link: ${linkError.message}`, {
      op: 'link_lookup',
      sq_item_id: squareItemId,
      sq_variation_id: squareVariationId,
      detail: linkError.message
    });
  }
  
  if (linkData?.product_id) {
    existingProductId = linkData.product_id;
    console.log(`🔗 Found existing product via link: ${existingProductId}`);
  }

  if (existingProductId) {
    // Step 2: Update existing product
    const { data: existingProduct, error: fetchError } = await supabase
      .from('products')
      .select('id, name, sku, retail_price_cents, currency_code, upc')
      .eq('id', existingProductId)
      .single();

    if (fetchError) {
      console.error(`Error fetching existing product ${existingProductId}:`, fetchError);
      throw fetchError;
    }

    if (existingProduct) {
      // Update existing product with improved data (only if we have better info)
      const updateData: any = {};
      if (productName && productName !== existingProduct.name) {
        updateData.name = productName;
      }
      if (sku && sku !== existingProduct.sku) {
        updateData.sku = sku;
      }
      if (priceCents !== null && priceCents !== existingProduct.retail_price_cents) {
        updateData.retail_price_cents = priceCents;
      }
      if (currencyCode !== existingProduct.currency_code) {
        updateData.currency_code = currencyCode;
      }
      // Only update UPC if we have one and existing doesn't, or if it matches
      if (upc && (!existingProduct.upc || existingProduct.upc === upc)) {
        updateData.upc = upc;
      }

      if (Object.keys(updateData).length > 0) {
        try {
          await supabase
            .from('products')
            .update({
              ...updateData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProductId)
            .throwOnError();

        } catch (updateError: any) {
          // Handle UPC uniqueness violation gracefully
          if (updateError.code === '23505' && updateError.message?.includes('upc')) {
            console.warn(`⚠️ UPC conflict updating product ${existingProductId}: ${upc} already exists`);
            // Continue without UPC update
            const updateWithoutUpc = { ...updateData };
            delete updateWithoutUpc.upc;
            
            if (Object.keys(updateWithoutUpc).length > 0) {
              await supabase
                .from('products')
                .update({
                  ...updateWithoutUpc,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingProductId)
                .throwOnError();
            }
          } else {
            throw updateError;
          }
        }

        console.log(`✅ Updated existing product: ${existingProductId}`);
        return { created: false, updated: true, productId: existingProductId };
      }
      
      return { created: false, updated: false, productId: existingProductId }; // No updates needed
    }
  }

  // Step 3: No existing product found - create new one
  console.log(`🆕 Creating new product: ${productName}`);
  
  let newProductId: string;
  
  try {
    const { data: newProduct } = await supabase
      .from('products')
      .insert({
        name: productName,
        sku: sku,
        upc: upc,
        retail_price_cents: priceCents,
        currency_code: currencyCode,
        origin: 'SQUARE',
        sync_state: 'SYNCED',
        catalog_status: 'ACTIVE'
      })
      .select('id')
      .single()
      .throwOnError();

    newProductId = newProduct.id;
  } catch (createError: any) {
    // Handle UPC uniqueness violation during creation
    if (createError.code === '23505' && createError.message?.includes('upc')) {
      console.warn(`⚠️ UPC conflict creating product: ${upc} already exists, creating without UPC`);
      
      const { data: fallbackProduct } = await supabase
        .from('products')
        .insert({
          name: productName,
          sku: sku,
          retail_price_cents: priceCents,
          currency_code: currencyCode,
          origin: 'SQUARE',
          sync_state: 'SYNCED',
          catalog_status: 'ACTIVE'
        })
        .select('id')
        .single()
        .throwOnError();
      
      newProductId = fallbackProduct.id;
    } else {
      throw createError;
    }
  }

  console.log(`✅ Created new product: ${newProductId}`);

  // Step 4: Create the POS link
  try {
    await supabase
      .from('product_pos_links')
      .insert({
        integration_id: integrationId,
        product_id: newProductId,
        pos_item_id: squareItemId,
        pos_variation_id: squareVariationId,
        source: 'SQUARE'
      })
      .throwOnError();

    console.log(`🔗 Created POS link for product: ${newProductId}`);
  } catch (linkError: any) {
    // If link creation fails due to duplicate, it's likely idempotent - log but don't fail
    if (linkError.code === '23505') {
      console.log(`ℹ️ Link already exists for product ${newProductId} (idempotent)`);
    } else {
      await appendError(runId, 'LINK_CREATE_FAILED', `Failed to create POS link: ${linkError.message}`, {
        op: 'create_link',
        table: 'product_pos_links',
        product_id: newProductId,
        sq_item_id: squareItemId,
        sq_variation_id: squareVariationId,
        detail: linkError.message
      });
      throw linkError;
    }
  }
  
  return { created: true, updated: false, productId: newProductId };
}

function sleep(ms: number) { 
  return new Promise((r) => setTimeout(r, ms)); 
}

function tryParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}