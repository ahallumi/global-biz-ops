// Variation-aware Square Import Function
// This implements the two-pass approach to fix the "0 processed items" issue

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SQUARE_API_BASE = Deno.env.get("SQUARE_API_BASE") ?? "https://connect.squareup.com/v2";
const IMPORT_MAX_SECONDS = Number(Deno.env.get("IMPORT_MAX_SECONDS") ?? 50);
const IMPORT_PAGE_SIZE = Number(Deno.env.get("IMPORT_PAGE_SIZE") ?? 100);

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
        const accessToken = await getAccessToken(body.integrationId);
        const who = await squareWhoAmI(accessToken);
        await appendError(runId, "INFO", `Square merchant: ${who.merchantId} (${who.businessName || "?"}) @ ${SQUARE_API_BASE}`);

        // First page fetch to kickstart and avoid "PENDING forever"
        const first = await searchCatalog(accessToken, undefined);
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

async function appendError(runId: string, code: string, msg: string) {
  const run = await getRun(runId);
  const errors = Array.isArray(run?.errors) ? run.errors : [];
  errors.push({ ts: new Date().toISOString(), code, msg });
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

async function getAccessToken(integrationId: string): Promise<string> {
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
    
    console.log("Successfully retrieved Square credentials");
    return data[0].access_token as string;
  } catch (e) {
    console.error("getAccessToken failed:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Square credentials error: ${errorMessage}`);
  }
}

async function squareWhoAmI(accessToken: string) {
  const resp = await fetch(`${SQUARE_API_BASE}/merchants/me`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Square whoami failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const m = data.merchant || data.merchants?.[0] || {};
  return { merchantId: m.id, businessName: m.business_name, country: m.country }; 
}

async function searchCatalog(accessToken: string, cursor?: string): Promise<SquareSearchResponse> {
  const url = `${SQUARE_API_BASE}/catalog/search-catalog-objects`;
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
      },
      body: JSON.stringify(body),
    });
    
    if (resp.status === 429 || resp.status >= 500) {
      await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
      continue;
    }
    
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Square searchCatalog failed: ${resp.status} ${text}`);
    }
    
    const result = await resp.json();
    return {
      objects: result.objects ?? [],
      related_objects: result.related_objects ?? [],
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
    let accessToken: string;
    try {
      accessToken = await getAccessToken(integrationId);
      const who = await squareWhoAmI(accessToken);
      await appendError(runId, "INFO", `Square merchant: ${who.merchantId} (${who.businessName || "?"}) @ ${SQUARE_API_BASE}`);
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

    console.log("🔄 Starting Collection Pass...");
    
    // PHASE 1: Collection Pass - gather all items and variations
    while (true) {
      const fresh = await getRun(runId);
      if (fresh?.status === "FAILED") {
        return { ok: false, aborted: true };
      }

      const page = await searchCatalog(accessToken, cursor);
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

    const result = await upsertItemsWithVariations(merged, integrationId);
    created += result.created;
    updated += result.updated;

    await updateRun(runId, {
      processed_count: processed,
      created_count: created,
      updated_count: updated,
      status: "SUCCESS",
      finished_at: new Date().toISOString(),
    });

    await updateIntegrationLastError(integrationId, null);
    console.log(`✅ Import completed: ${created} created, ${updated} updated`);
    return { ok: true, done: true, processed, created, updated };

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
): Promise<{ created: number; updated: number }> {
  let created = 0, updated = 0;
  
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

        // Check for existing link by variation id
        const { data: link, error: linkErr } = await supabaseAdmin
          .from("product_pos_links")
          .select("product_id")
          .eq("pos_item_id", sqItemId)
          .eq("pos_variation_id", varId)
          .eq("source", "SQUARE")
          .maybeSingle();
        
        if (linkErr) throw linkErr;

        if (link?.product_id) {
          // Update existing product
          const { error: upErr } = await supabaseAdmin
            .from("products")
            .update({ 
              name: varName, 
              sku: varSku, 
              upc: varUpc,
              retail_price_cents: varPrice 
            })
            .eq("id", link.product_id);
          if (upErr) throw upErr;
          updated++;
        } else {
          // Create new product
          const { data: prod, error: insErr } = await supabaseAdmin
            .from("products")
            .insert({ 
              name: varName, 
              sku: varSku, 
              upc: varUpc,
              retail_price_cents: varPrice,
              origin: "SQUARE"
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          
          // Create link
          const { error: linkInsErr } = await supabaseAdmin
            .from("product_pos_links")
            .insert({ 
              product_id: prod.id, 
              source: "SQUARE", 
              pos_item_id: sqItemId,
              pos_variation_id: varId
            });
          if (linkInsErr) throw linkInsErr;
          created++;
        }
      }
    } else {
      // Single product (no variations)
      const { data: link, error: linkErr } = await supabaseAdmin
        .from("product_pos_links")
        .select("product_id")
        .eq("pos_item_id", sqItemId)
        .eq("source", "SQUARE")
        .is("pos_variation_id", null)
        .maybeSingle();
      
      if (linkErr) throw linkErr;

      if (link?.product_id) {
        // Update existing product
        const { error: upErr } = await supabaseAdmin
          .from("products")
          .update({ name, sku, upc })
          .eq("id", link.product_id);
        if (upErr) throw upErr;
        updated++;
      } else {
        // Create new product
        const { data: prod, error: insErr } = await supabaseAdmin
          .from("products")
          .insert({ 
            name, 
            sku, 
            upc,
            origin: "SQUARE"
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        
        // Create link
        const { error: linkInsErr } = await supabaseAdmin
          .from("product_pos_links")
          .insert({ 
            product_id: prod.id, 
            source: "SQUARE", 
            pos_item_id: sqItemId
          });
        if (linkInsErr) throw linkInsErr;
        created++;
      }
    }
  }
  
  return { created, updated };
}

function sleep(ms: number) { 
  return new Promise((r) => setTimeout(r, ms)); 
}