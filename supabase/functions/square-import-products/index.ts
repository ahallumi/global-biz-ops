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
          status: first.cursor ? "PARTIAL" : "SUCCESS",
          finished_at: first.cursor ? null : new Date().toISOString(),
        });

        // If more to do, chain a CONTINUE
        if (first.cursor) await selfInvoke({ integrationId: body.integrationId, mode: "CONTINUE", runId });
        else await updateIntegrationLastError(body.integrationId, null);

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

async function appendError(runId: string, code: string, detail: string, context?: { 
  op?: string; 
  table?: string; 
  sq_item_id?: string; 
  sq_variation_id?: string; 
  product_id?: string; 
  upc?: string; 
  sku?: string; 
}) {
  const run = await getRun(runId);
  const errors = Array.isArray(run?.errors) ? run.errors : [];
  
  // Cap errors at 500 to prevent huge arrays
  if (errors.length >= 500) {
    const summary = `... and ${errors.length - 499} more errors (capped for performance)`;
    if (errors[499]?.summary !== summary) {
      errors[499] = { 
        ts: new Date().toISOString(), 
        code: "ERROR_CAP", 
        detail: summary 
      };
    }
  } else {
    errors.push({ 
      ts: new Date().toISOString(), 
      code, 
      detail,
      ...context
    });
  }
  
  await updateRun(runId, { errors });
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

// Legacy wrapper for backward compatibility
async function getAccessToken(integrationId: string): Promise<string> {
  const creds = await getSquareCreds(integrationId);
  return creds.accessToken;
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
    let created = run.created_count ?? 0;
    let updated = run.updated_count ?? 0;

    // Collection maps for two-pass approach
    const itemMap = new Map<string, any>();
    const variationMap = new Map<string, any>();
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
          variationMap.set(variation.id, variation);
        }
      }

      processed += items.length + related.length;

      // Update progress
      cursor = page.cursor;
      await updateRun(runId, {
        cursor: cursor ?? null,
        processed_count: processed,
        created_count: created,
        updated_count: updated,
      });

      // Yield if time budget exceeded
      const elapsed = (Date.now() - started) / 1000;
      if (elapsed > IMPORT_MAX_SECONDS - 5) {
        await updateRun(runId, { status: cursor ? "PARTIAL" : "RUNNING" });
        if (cursor) await selfInvoke({ integrationId, mode: "CONTINUE", runId });
        return { ok: true, yielded: Boolean(cursor), processed, created, updated };
      }

      if (!cursor) break; // Collection complete
    }

    console.log(`📦 Collection complete: ${itemMap.size} items, ${variationMap.size} variations`);

    // Check for empty catalog
    if (itemMap.size === 0) {
      await appendError(runId, "EMPTY_CATALOG", "No items found in Square catalog. Check permissions or environment.");
      await updateRun(runId, { status: "SUCCESS", finished_at: new Date().toISOString() });
      await updateIntegrationLastError(integrationId, "Empty catalog - no items found");
      return { ok: true, done: true, processed, created: 0, updated: 0 };
    }

    console.log("⚙️ Starting Processing Pass...");
    
    // PHASE 2: Processing Pass - create/update products
    const merged: Array<{ item: any; variations: any[] }> = [];
    for (const [id, item] of itemMap) {
      const vIds = item?.item_data?.variations?.map((v: any) => v.id).filter(Boolean) || [];
      const vars = vIds.map((vid: string) => variationMap.get(vid)).filter(Boolean);
      merged.push({ item, variations: vars });
    }

    const result = await upsertItemsWithVariations(merged, integrationId, runId);
    created += result.created;
    updated += result.updated;
    const failedCount = result.failed;

    const finalStatus = failedCount > 0 && created === 0 && updated === 0 ? "FAILED" : "SUCCESS";
    
    await updateRun(runId, {
      processed_count: processed,
      created_count: created,
      updated_count: updated,
      failed_count: failedCount,
      status: finalStatus,
      finished_at: new Date().toISOString(),
    });

    await updateIntegrationLastError(integrationId, null);
    console.log(`✅ Import completed: ${created} created, ${updated} updated, ${failedCount} failed`);
    return { ok: true, done: true, processed, created, updated, failed: failedCount };

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
  merged: Array<{ item: any; variations: any[] }>,
  integrationId: string,
  runId: string
): Promise<{ created: number; updated: number; failed: number }> {
  let created = 0, updated = 0, failed = 0;
  let processedItems = 0;
  
  for (const { item, variations } of merged) {
    const sqItemId = item.id;
    const name = item?.item_data?.name ?? "Unnamed";
    const sku = item?.item_data?.sku ?? null;
    const upc = item?.item_data?.upc ?? null;

    // If item has variations, process each variation as a separate product
    if (variations.length > 0) {
      for (const variation of variations) {
        const varId = variation.id;
        const varName = variation?.item_variation_data?.name ?? name;
        const varSku = variation?.item_variation_data?.sku ?? sku;
        const varUpc = variation?.item_variation_data?.upc ?? upc;
        const varPrice = variation?.item_variation_data?.price_money?.amount ?? null;

        try {
          const result = await upsertSingleProduct(
            sqItemId, varId, varName, varSku, varUpc, varPrice, integrationId, runId
          );
          if (result.created) created++;
          else if (result.updated) updated++;
        } catch (e) {
          failed++;
          const errorMessage = e instanceof Error ? e.message : String(e);
          await appendError(runId, "ITEM_FAILED", errorMessage, {
            op: "upsert_variation",
            sq_item_id: sqItemId,
            sq_variation_id: varId,
            upc: varUpc || undefined,
            sku: varSku || undefined
          });
          console.error(`Failed to process variation ${varId}:`, e);
        }

        processedItems++;
        
        // Incremental progress update every 25 items
        if (processedItems % 25 === 0) {
          await updateRun(runId, {
            created_count: created,
            updated_count: updated,
            failed_count: failed,
            last_progress_at: new Date().toISOString()
          });
        }
      }
    } else {
      // Single product (no variations)
      try {
        const result = await upsertSingleProduct(
          sqItemId, null, name, sku, upc, null, integrationId, runId
        );
        if (result.created) created++;
        else if (result.updated) updated++;
      } catch (e) {
        failed++;
        const errorMessage = e instanceof Error ? e.message : String(e);
        await appendError(runId, "ITEM_FAILED", errorMessage, {
          op: "upsert_item",
          sq_item_id: sqItemId,
          upc: upc || undefined,
          sku: sku || undefined
        });
        console.error(`Failed to process item ${sqItemId}:`, e);
      }

      processedItems++;
      
      // Incremental progress update every 25 items
      if (processedItems % 25 === 0) {
        await updateRun(runId, {
          created_count: created,
          updated_count: updated,
          failed_count: failed,
          last_progress_at: new Date().toISOString()
        });
      }
    }
  }

  // Final progress update
  await updateRun(runId, {
    created_count: created,
    updated_count: updated,
    failed_count: failed,
    last_progress_at: new Date().toISOString()
  });

  return { created, updated, failed };
}

async function upsertSingleProduct(
  sqItemId: string, 
  varId: string | null, 
  name: string, 
  sku: string | null, 
  upc: string | null, 
  price: number | null,
  integrationId: string,
  runId: string
): Promise<{ created?: boolean; updated?: boolean }> {
  
  // Step 1: Check for existing Square ID link (highest priority) - scoped by integration
  const linkQuery = supabaseAdmin
    .from("product_pos_links")
    .select("product_id")
    .eq("integration_id", integrationId)
    .eq("pos_item_id", sqItemId)
    .eq("source", "SQUARE");
    
  if (varId) {
    linkQuery.eq("pos_variation_id", varId);
  } else {
    linkQuery.is("pos_variation_id", null);
  }
  
  const { data: link, error: linkErr } = await linkQuery.maybeSingle();
  if (linkErr) throw linkErr;

  let productId: string | null = null;
  
  if (link?.product_id) {
    productId = link.product_id;
  } else {
    // Step 2: Check for UPC match (if UPC exists and is non-empty)
    if (upc && upc.trim()) {
      const { data: upcProduct } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("upc", upc.trim())
        .maybeSingle();
      
      if (upcProduct?.id) {
        productId = upcProduct.id;
        // Create the missing link - gracefully handle duplicates
        try {
          await supabaseAdmin
            .from("product_pos_links")
            .insert({ 
              product_id: productId, 
              source: "SQUARE", 
              integration_id: integrationId,
              pos_item_id: sqItemId,
              pos_variation_id: varId
            });
        } catch (e: any) {
          // Ignore unique constraint violations on links (idempotency)
          if (e?.code !== '23505') throw e;
        }
      }
    }
    
    // Step 3: Check for SKU match (if SKU exists, is non-empty, and no UPC match)
    if (!productId && sku && sku.trim()) {
      const { data: skuProduct } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("sku", sku.trim())
        .maybeSingle();
      
      if (skuProduct?.id) {
        productId = skuProduct.id;
        // Create the missing link - gracefully handle duplicates
        try {
          await supabaseAdmin
            .from("product_pos_links")
            .insert({ 
              product_id: productId, 
              source: "SQUARE", 
              integration_id: integrationId,
              pos_item_id: sqItemId,
              pos_variation_id: varId
            });
        } catch (e: any) {
          // Ignore unique constraint violations on links (idempotency)
          if (e?.code !== '23505') throw e;
        }
      }
    }
  }

  if (productId) {
    // Update existing product - only update fields that are present and non-null/non-empty
    const updateData: any = {};
    
    // Always update name if it's meaningful
    if (name && name.trim() && name.trim() !== "Unnamed") {
      updateData.name = name.trim();
    }
    
    // Only update SKU if it's present and non-empty
    if (sku && sku.trim()) {
      updateData.sku = sku.trim();
    }
    
    // Only update price if it's a valid positive number
    if (price !== null && price > 0) {
      updateData.retail_price_cents = price;
    }
    
    // Handle UPC separately to avoid conflicts
    let shouldUpdateUpc = upc && upc.trim();
    if (shouldUpdateUpc) {
      updateData.upc = upc.trim();
    }
    
    // Skip update if no meaningful changes
    if (Object.keys(updateData).length === 0) {
      return { updated: false };
    }
    
    try {
      const { error: upErr } = await supabaseAdmin
        .from("products")
        .update(updateData)
        .eq("id", productId);
      if (upErr) throw upErr;
      return { updated: true };
    } catch (e: any) {
      // Handle UPC uniqueness conflict with proper error code check
      if (e?.code === '23505' && e?.message?.includes('products_upc_key') && shouldUpdateUpc) {
        await appendError(runId, "UPC_CONFLICT", `UPC ${upc} already exists, skipping UPC update`, {
          op: "update_product",
          table: "products",
          product_id: productId,
          upc: upc
        });
        // Retry without UPC
        delete updateData.upc;
        if (Object.keys(updateData).length > 0) {
          const { error: retryErr } = await supabaseAdmin
            .from("products")
            .update(updateData)
            .eq("id", productId);
          if (retryErr) throw retryErr;
        }
        return { updated: true };
      }
      throw e;
    }
  } else {
    // Create new product - only include fields that are meaningful
    const insertData: any = { 
      origin: "SQUARE",
      sync_state: "SYNCED"
    };
    
    // Always set name, with fallback
    insertData.name = (name && name.trim() && name.trim() !== "Unnamed") ? name.trim() : `Square Item ${sqItemId}`;
    
    // Only include fields that are present and non-empty
    if (sku && sku.trim()) insertData.sku = sku.trim();
    if (price !== null && price > 0) insertData.retail_price_cents = price;
    
    // Handle UPC separately to avoid conflicts
    let shouldInsertUpc = upc && upc.trim();
    if (shouldInsertUpc) {
      insertData.upc = upc.trim();
    }
    
    try {
      const { data: prod, error: insErr } = await supabaseAdmin
        .from("products")
        .insert(insertData)
        .select("id")
        .single();
      if (insErr) throw insErr;
      
      // Create link
      const { error: linkInsErr } = await supabaseAdmin
        .from("product_pos_links")
        .insert({ 
          product_id: prod.id, 
          source: "SQUARE", 
          integration_id: integrationId,
          pos_item_id: sqItemId,
          pos_variation_id: varId
        });
      if (linkInsErr) throw linkInsErr;
      return { created: true };
    } catch (e: any) {
      // Handle UPC uniqueness conflict with proper error code check
      if (e?.code === '23505' && e?.message?.includes('products_upc_key') && shouldInsertUpc) {
        await appendError(runId, "UPC_CONFLICT", `UPC ${upc} already exists, creating product without UPC`, {
          op: "create_product", 
          table: "products",
          upc: upc
        });
        // Retry without UPC
        delete insertData.upc;
        const { data: prod, error: retryErr } = await supabaseAdmin
          .from("products")
          .insert(insertData)
          .select("id")
          .single();
        if (retryErr) throw retryErr;
        
        // Create link
        const { error: linkInsErr } = await supabaseAdmin
          .from("product_pos_links")
          .insert({ 
            product_id: prod.id, 
            source: "SQUARE", 
            integration_id: integrationId,
            pos_item_id: sqItemId,
            pos_variation_id: varId
          });
        if (linkInsErr) throw linkInsErr;
        return { created: true };
      }
      throw e;
    }
  }
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