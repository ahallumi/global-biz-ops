// deno-lint-ignore-file no-explicit-any
// Deno Edge Function (Supabase) — implements CPU-safe, variation-aware Square import
// Requires env:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY (used by clients that start the run; function uses SERVICE_ROLE for DB writes)
// - SUPABASE_SERVICE_ROLE_KEY (self-invoke + privileged writes)
// - SUPABASE_FUNCTION_URL (https://<project-ref>.functions.supabase.co/functions/v1)
// - APP_CRYPT_KEY2 (for decrypting Square credentials)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RunMode = "START" | "RESUME";
type Source = "SQUARE";

const MAX_PRODUCTS_PER_SEGMENT = 600; // hard cap per segment, prevents CPU-time shutdowns
const WALL_MS = 7 * 60 * 1000;        // soft wall-clock budget (we still rely mainly on MAX_PRODUCTS_PER_SEGMENT)
const BATCH_COMMIT = 40;              // how often to persist counts/cursor mid-run
const RESUME_DELAY_MS = 50;           // tiny delay before self-invoke (gives DB time to flush)

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface ImportRun {
  id: string;
  integration_id: string;
  status: "PENDING" | "RUNNING" | "PARTIAL" | "SUCCESS" | "FAILED";
  cursor: string | null;
  created_count: number;
  updated_count: number;
  processed_count: number;
  errors: string[] | null;
}

interface StartPayload {
  mode?: RunMode;
  integrationId?: string;
  runId?: string;
}

interface SquareListResponse {
  objects?: any[]; // Catalog objects (ITEM, ITEM_VARIATION)
  cursor?: string;
  errors?: { category: string; code: string; detail: string }[];
}

interface SquareItem {
  id: string;
  type: "ITEM";
  item_data?: {
    name?: string;
    variations?: { id: string }[]; // minimal descriptors
    category_id?: string;
    is_deleted?: boolean;
  };
}

interface SquareVariation {
  id: string;
  type: "ITEM_VARIATION";
  item_variation_data?: {
    item_id?: string;
    name?: string;
    sku?: string;
    upc?: string;
    plu?: string;
    price_money?: { amount?: number };
    measurement_unit_id?: string;
    is_deleted?: boolean;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as StartPayload;
    const mode = payload.mode || (payload.runId ? "RESUME" : "START");
    const integrationId = payload.integrationId;
    const runId = payload.runId;

    if (mode === "RESUME" && runId) {
      console.log('Resuming product import for run:', runId);
      
      // Verify the run exists and is in appropriate state
      const run = await getRun(runId);
      if (!run) {
        return json(404, { error: "Run not found" });
      }

      if (!['RUNNING', 'PARTIAL'].includes(run.status)) {
        return json(400, { error: `Cannot resume import with status: ${run.status}` });
      }

      // Resume the background import task
      EdgeRuntime.waitUntil(performImport(runId, run.integration_id));

      return json(200, { 
        success: true,
        run_id: runId,
        message: 'Import resumed in background'
      });
    }

    if (!integrationId) {
      return json(400, { error: "Missing integrationId" });
    }

    // Check if there's already a running import for this integration
    const { data: existingRun } = await db
      .from('product_import_runs')
      .select('id, status')
      .eq('integration_id', integrationId)
      .in('status', ['RUNNING', 'PENDING'])
      .maybeSingle();

    if (existingRun) {
      return json(409, { 
        error: 'Import already in progress',
        existing_run_id: existingRun.id
      });
    }

    console.log('Starting product import for integration:', integrationId);

    // Create import run record with PENDING status
    const { data: importRun, error: runError } = await db
      .from('product_import_runs')
      .insert({
        integration_id: integrationId,
        status: 'PENDING',
        created_count: 0,
        updated_count: 0,
        processed_count: 0
      })
      .select()
      .maybeSingle();

    if (runError || !importRun) {
      throw new Error(`Failed to create import run: ${runError?.message}`);
    }

    // Start the background import task
    EdgeRuntime.waitUntil(performImport(importRun.id, integrationId));

    // Return immediate response
    return json(200, { 
      success: true,
      run_id: importRun.id,
      message: 'Import started in background'
    });

  } catch (error) {
    console.error('Import initialization failed:', error);
    return json(400, { error: error.message });
  }
});

async function performImport(runId: string, integrationId: string) {
  const startedAt = Date.now();
  let processedThisSegment = 0;

  try {
    // Fetch run record (authoritative source of cursor/counters)
    const run = await getRun(runId);
    if (!run) {
      console.error('Run not found:', runId);
      return;
    }

    // Mark running if first segment
    if (run.status === "PENDING") {
      await updateRun(runId, { status: "RUNNING" });
    }

    // Get Square credentials
    const { accessToken, environment } = await getSquareCredentials(integrationId);
    const baseUrl = environment === 'SANDBOX' 
      ? 'https://connect.squareupsandbox.com' 
      : 'https://connect.squareup.com';

    let cursor = run.cursor ?? null;
    let created = run.created_count ?? 0;
    let updated = run.updated_count ?? 0;

    console.log(`🚀 Background import started for run: ${runId}`);

    // Segment loop
    segment: while (true) {
      // Respect caps
      if (processedThisSegment >= MAX_PRODUCTS_PER_SEGMENT) {
        await persistAndMaybeResume(runId, cursor, created, updated, "PARTIAL");
        break segment;
      }
      if (Date.now() - startedAt > WALL_MS) {
        await persistAndMaybeResume(runId, cursor, created, updated, "PARTIAL");
        break segment;
      }

      // Check for cancellation
      const runCheck = await getRun(runId);
      if (runCheck?.status !== 'RUNNING') {
        console.log('Import was cancelled, stopping...');
        break segment;
      }

      // Fetch a catalog page (ITEM + ITEM_VARIATION)
      const page = await fetchSquareCatalogPage(cursor, accessToken, baseUrl);
      if (page.errors?.length) {
        // Backoff for transient errors; persist and continue next segment
        await sleep(300);
        await persistAndMaybeResume(runId, cursor, created, updated, "PARTIAL", `Square error: ${page.errors[0].code} ${page.errors[0].detail}`);
        break segment;
      }

      const objects = page.objects ?? [];
      if (objects.length === 0) {
        // No more objects: finalize
        await updateRun(runId, {
          status: "SUCCESS",
          cursor: null,
          created_count: created,
          updated_count: updated,
          finished_at: new Date().toISOString(),
          errors: null,
        });
        console.log(`Import completed: ${created} created, ${updated} updated`);
        return;
      }

      // Split objects by type and build quick lookups
      const items: SquareItem[] = objects.filter(o => o.type === "ITEM");
      const variations: SquareVariation[] = objects.filter(o => o.type === "ITEM_VARIATION");

      const variationsByItem = groupVariationsByItem(variations);

      // Process each item according to variation rules
      for (const item of items) {
        if (processedThisSegment >= MAX_PRODUCTS_PER_SEGMENT) break;

        const hasDeclaredVariations = !!item.item_data?.variations?.length;

        if (hasDeclaredVariations) {
          // Only process actual variations; if none from this page, SKIP for now
          const onPageVars = variationsByItem.get(item.id) ?? [];
          if (onPageVars.length === 0) {
            console.log(`[SKIP] Item ${item.id} has variations, but none present on this page`);
            continue;
          }

          for (const v of onPageVars) {
            // Existing link check for (variation, location_id = null)
            const existingLink = await getExistingLink({
              source: "SQUARE",
              pos_item_id: item.id,
              pos_variation_id: v.id,
              location_id_null: true,
            });

            if (existingLink) {
              // Update product from item+variation data
              const ok = await updateProductFromSquare(existingLink.product_id, item, v);
              if (ok) updated++;
            } else {
              // Create new product, then create link; handle unique violation = UPDATE
              const productId = await createProductFromSquare(item, v);
              if (!productId) {
                // If creation failed, continue safely
                continue;
              }
              const linkRes = await createPosLink({
                source: "SQUARE",
                pos_item_id: item.id,
                pos_variation_id: v.id,
                location_id: null,
                product_id: productId,
              });

              if (linkRes === "OK") {
                created++;
              } else if (linkRes === "UNIQUE_VIOLATION") {
                const link = await getExistingLink({
                  source: "SQUARE",
                  pos_item_id: item.id,
                  pos_variation_id: v.id,
                  location_id_null: true,
                });
                if (link) {
                  await updateProductFromSquare(link.product_id, item, v);
                  updated++;
                }
              } // else other error already logged
            }

            processedThisSegment++;
            if (processedThisSegment % BATCH_COMMIT === 0) {
              await updateRun(runId, {
                cursor,
                created_count: created,
                updated_count: updated,
                processed_count: run.processed_count + processedThisSegment,
                status: "RUNNING",
              });
            }
            if (processedThisSegment >= MAX_PRODUCTS_PER_SEGMENT) break;
            if (Date.now() - startedAt > WALL_MS) break;
          }
        } else {
          // Single-product (no variations)
          const existingLink = await getExistingLink({
            source: "SQUARE",
            pos_item_id: item.id,
            pos_variation_id_null: true,
            location_id_null: true,
          });

          if (existingLink) {
            const ok = await updateProductFromSquare(existingLink.product_id, item, null);
            if (ok) updated++;
          } else {
            const productId = await createProductFromSquare(item, null);
            if (!productId) {
              // If creation failed, continue safely
              continue;
            }
            const linkRes = await createPosLink({
              source: "SQUARE",
              pos_item_id: item.id,
              pos_variation_id: null,
              location_id: null,
              product_id: productId,
            });

            if (linkRes === "OK") {
              created++;
            } else if (linkRes === "UNIQUE_VIOLATION") {
              const link = await getExistingLink({
                source: "SQUARE",
                pos_item_id: item.id,
                pos_variation_id_null: true,
                location_id_null: true,
              });
              if (link) {
                await updateProductFromSquare(link.product_id, item, null);
                updated++;
              }
            }
          }

          processedThisSegment++;
          if (processedThisSegment % BATCH_COMMIT === 0) {
            await updateRun(runId, {
              cursor,
              created_count: created,
              updated_count: updated,
              processed_count: run.processed_count + processedThisSegment,
              status: "RUNNING",
            });
          }
        }

        // Soft exit checks inside item loop as well
        if (processedThisSegment >= MAX_PRODUCTS_PER_SEGMENT) break;
        if (Date.now() - startedAt > WALL_MS) break;
      }

      // Advance cursor and continue segment if allowed
      cursor = page.cursor ?? null;

      // If no cursor returned, finalize
      if (!cursor) {
        await updateRun(runId, {
          status: "SUCCESS",
          cursor: null,
          created_count: created,
          updated_count: updated,
          processed_count: run.processed_count + processedThisSegment,
          finished_at: new Date().toISOString(),
          errors: null,
        });
        console.log(`Import completed: ${created} created, ${updated} updated`);
        return;
      }
    }

    // Update integration success status
    await db
      .from('inventory_integrations')
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null
      })
      .eq('id', integrationId);

    // Segment cut happened inside loop (cap or time): response already handled in persistAndMaybeResume
    console.log(`Segment completed: ${processedThisSegment} processed this segment`);
  } catch (e) {
    console.error("Fatal import error:", e);
    await updateRun(runId, {
      status: "FAILED",
      finished_at: new Date().toISOString(),
      errors: [String(e)]
    });

    // Update integration error status
    await db
      .from('inventory_integrations')
      .update({
        last_error: String(e)
      })
      .eq('id', integrationId);
  }
}

// ---------- Helpers ----------

async function getRun(id: string): Promise<ImportRun | null> {
  const { data, error } = await db.from("product_import_runs").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("getRun error:", error);
    return null;
  }
  return data as ImportRun | null;
}

async function updateRun(id: string, patch: Partial<ImportRun>) {
  const { error } = await db.from("product_import_runs").update(patch).eq("id", id);
  if (error) console.error("updateRun error:", error);
}

async function persistAndMaybeResume(
  run_id: string,
  cursor: string | null,
  created: number,
  updated: number,
  status: "PARTIAL" | "RUNNING",
  errorMsg?: string
) {
  await updateRun(run_id, {
    cursor,
    created_count: created,
    updated_count: updated,
    status,
    errors: errorMsg ? [errorMsg] : null,
  });

  // Self-invoke to continue (best-effort)
  try {
    await sleep(RESUME_DELAY_MS);
    const functionsUrl = SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co');
    const res = await fetch(`${functionsUrl}/functions/v1/square-import-products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ mode: "RESUME", runId: run_id }),
    });
    if (!res.ok) {
      console.warn("Self-invoke returned non-OK:", res.status, await safeText(res));
    }
  } catch (e) {
    console.warn("Self-invoke failed (will rely on manual/cron resume):", e);
  }
}

async function getSquareCredentials(integrationId: string) {
  const appCryptKey = Deno.env.get('APP_CRYPT_KEY2');
  if (!appCryptKey) {
    throw new Error('APP_CRYPT_KEY2 not configured');
  }

  const { data: credentialsData, error: credentialsError } = await db.rpc('get_decrypted_credentials', {
    p_integration_id: integrationId,
    p_crypt_key: appCryptKey
  });

  if (credentialsError || !credentialsData || !Array.isArray(credentialsData) || credentialsData.length === 0) {
    throw new Error('Failed to retrieve credentials');
  }

  const { access_token, environment } = credentialsData[0];
  return { accessToken: access_token, environment };
}

function groupVariationsByItem(variations: SquareVariation[]) {
  const m = new Map<string, SquareVariation[]>();
  for (const v of variations) {
    const itemId = v.item_variation_data?.item_id;
    if (!itemId) continue;
    if (!m.has(itemId)) m.set(itemId, []);
    m.get(itemId)!.push(v);
  }
  return m;
}

async function fetchSquareCatalogPage(cursor: string | null, accessToken: string, baseUrl: string): Promise<SquareListResponse> {
  const params = new URLSearchParams();
  params.set("types", "ITEM,ITEM_VARIATION");
  params.set("limit", "100");
  if (cursor) params.set("cursor", cursor);

  // Square ListCatalog
  const url = `${baseUrl}/v2/catalog/list?${params.toString()}`;
  const res = await fetchWithBackoff(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-12-18",
    },
  });

  if (!res.ok) {
    const body = await safeText(res);
    console.warn("Square list error:", res.status, body);
    return { errors: [{ category: "API_ERROR", code: String(res.status), detail: body.slice(0, 300) }] };
  }
  return await res.json();
}

async function fetchWithBackoff(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const r = await fetch(url, init);
  if (r.status === 429 || r.status >= 500) {
    if (attempt < 3) {
      const wait = 200 + attempt * 300;
      await sleep(wait);
      return fetchWithBackoff(url, init, attempt + 1);
    }
  }
  return r;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "<no-text>";
  }
}

// ----- Product + Link IO -----

async function getExistingLink(opts: {
  source: Source;
  pos_item_id: string;
  pos_variation_id?: string;
  pos_variation_id_null?: boolean;
  location_id_null?: boolean;
}) {
  let q = db.from("product_pos_links").select("*")
    .eq("source", opts.source)
    .eq("pos_item_id", opts.pos_item_id);

  if (opts.pos_variation_id_null) q = q.is("pos_variation_id", null);
  else if (opts.pos_variation_id) q = q.eq("pos_variation_id", opts.pos_variation_id);

  if (opts.location_id_null) q = q.is("location_id", null);

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error("getExistingLink error:", error);
    return null;
  }
  return data;
}

async function createPosLink(link: {
  source: Source;
  pos_item_id: string;
  pos_variation_id: string | null;
  location_id: string | null;
  product_id: string;
}): Promise<"OK" | "UNIQUE_VIOLATION" | "ERROR"> {
  const { error } = await db.from("product_pos_links").insert(link);
  if (error) {
    // Postgres unique violation
    if ((error as any).code === "23505") {
      console.warn("createPosLink unique violation:", error.message);
      return "UNIQUE_VIOLATION";
    }
    console.error("createPosLink error:", error);
    return "ERROR";
  }
  return "OK";
}

// Map Square item/variation -> your product fields
function makeProductPayload(item: SquareItem, variation: SquareVariation | null) {
  const itemData = item.item_data || {};
  const variationData = variation?.item_variation_data || {};
  
  const name = variationData.name || itemData.name || "Unnamed Product";
  const sku = variationData.sku || null;
  const upc = variationData.upc || null;
  const plu = variationData.plu || null;
  
  // Determine unit of sale based on measurement unit or other indicators
  let unitOfSale = 'EACH';
  if (variationData.measurement_unit_id || 
      name.toLowerCase().includes('lb') ||
      name.toLowerCase().includes('pound')) {
    unitOfSale = 'WEIGHT';
  }

  return {
    name,
    sku,
    upc,
    plu,
    unit_of_sale: unitOfSale,
    weight_unit: unitOfSale === 'WEIGHT' ? 'LB' : null,
    retail_price_cents: variationData.price_money?.amount || null,
    category: itemData.category_id || null,
    size: (variationData.name !== itemData.name) ? variationData.name : null,
    catalog_status: (itemData.is_deleted || variationData.is_deleted) ? 'ARCHIVED' : 'ACTIVE',
    origin: 'SQUARE',
    sync_state: 'SYNCED',
    updated_at: new Date().toISOString()
  };
}

async function createProductFromSquare(item: SquareItem, variation: SquareVariation | null): Promise<string | null> {
  const payload = makeProductPayload(item, variation);
  const { data, error } = await db.from("products").insert(payload).select("id").maybeSingle();
  if (error) {
    console.error("createProduct error:", error);
    return null;
  }
  return data?.id ?? null;
}

async function updateProductFromSquare(product_id: string, item: SquareItem, variation: SquareVariation | null): Promise<boolean> {
  const payload = makeProductPayload(item, variation);
  const { error } = await db.from("products").update(payload).eq("id", product_id);
  if (error) {
    console.error("updateProduct error:", error);
    return false;
  }
  return true;
}

// ----- Small utils -----

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
      "Content-Type": "application/json",
      ...corsHeaders
    },
  });
}
