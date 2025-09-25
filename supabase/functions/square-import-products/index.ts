// Variation-aware Square Import Function
// This implements deterministic catalog mode system (SEARCH or LIST)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sleep utility function
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMPORT_MAX_SECONDS = Number(Deno.env.get("IMPORT_MAX_SECONDS") ?? 50);
const IMPORT_PAGE_SIZE = Number(Deno.env.get("IMPORT_PAGE_SIZE") ?? 100);

// Configuration flags for strict policies  
const ALLOW_ITEM_PRICE_FALLBACK = Deno.env.get("ALLOW_ITEM_PRICE_FALLBACK") === "true";
const REQUIRE_ENVIRONMENT = Deno.env.get("REQUIRE_ENVIRONMENT") !== "false";
const MAX_BATCH_RETRIEVE_IDS = Number(Deno.env.get("MAX_BATCH_RETRIEVE_IDS") ?? 200);

// Dynamic Square API base resolution
function resolveSquareBase(environment?: string | null): string {
  const env = (environment || "").toLowerCase();
  if (env === "sandbox" || env === "test") return "https://connect.squareupsandbox.com/v2";
  return "https://connect.squareup.com/v2";
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

interface SquareListResponse {
  objects?: any[];
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

      // Kickstart enhancement: immediately transition to RUNNING
      await updateRun(runId, { status: "RUNNING", processed_count: 0 });

      try {
        const creds = await getSquareCreds(body.integrationId);
        const who = await squareWhoAmI(creds.accessToken, creds.baseUrl);
        
        // Get catalog mode for this integration
        const integrationSettings = await getIntegrationSettings(body.integrationId);
        const catalogMode = integrationSettings.catalog_mode || 'SEARCH';
        
        // Log configuration on startup
        console.log(`🚀 Square Import Configuration:`, {
          REQUIRE_ENVIRONMENT,
          ALLOW_ITEM_PRICE_FALLBACK,
          IMPORT_PAGE_SIZE,
          MAX_BATCH_RETRIEVE_IDS,
          IMPORT_MAX_SECONDS,
          baseUrl: creds.baseUrl,
          environment: creds.environment || 'production',
          catalogMode
        });
        
        await appendError(runId, "INFO", `Square merchant: ${who.merchantId} (${who.businessName || "?"}) @ ${creds.baseUrl} (${creds.environment || 'production'})`);

        // Test catalog access first
        await testCatalogAccess(creds.accessToken, creds.baseUrl);

        // Always invoke CONTINUE to run processing pass - no first page fetch
        console.log(`Kickstart done; invoking CONTINUE`);
        await selfInvoke({ integrationId: body.integrationId, mode: "CONTINUE", runId });

        return json({ ok: true, runId, kickstarted: true });
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

// Integration settings helper
async function getIntegrationSettings(integrationId: string): Promise<{ catalog_mode?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('inventory_integrations')
      .select('catalog_mode')
      .eq('id', integrationId)
      .single();
    
    if (error) {
      console.error('Failed to get integration settings:', error);
      return { catalog_mode: 'SEARCH' };
    }
    return data || { catalog_mode: 'SEARCH' };
  } catch (err) {
    console.error('Error in getIntegrationSettings:', err);
    return { catalog_mode: 'SEARCH' };
  }
}

// Supabase interaction functions
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
    
    // Strict environment validation
    if (REQUIRE_ENVIRONMENT && !environment) {
      throw new Error("Square integration missing environment; set sandbox or production");
    }
    
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

// Square data fetching functions
async function listCatalog(accessToken: string, baseUrl: string, cursor?: string): Promise<SquareListResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('types', 'ITEM,ITEM_VARIATION');
  queryParams.append('limit', IMPORT_PAGE_SIZE.toString());
  if (cursor) {
    queryParams.append('cursor', cursor);
  }

  const response = await fetch(`${baseUrl}/catalog/list?${queryParams}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Square-Version': '2024-10-17',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`List catalog failed (${response.status}): ${error}`);
  }

  return response.json();
}

async function searchCatalog(accessToken: string, baseUrl: string, cursor?: string): Promise<SquareSearchResponse> {
  const url = `${baseUrl}/catalog/search-catalog-objects`;
  const body: any = {
    object_types: ["ITEM"],
    include_related_objects: false, // Changed to false for per-page processing
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
      
      if (resp.status === 404) {
        throw new Error(`SEARCH_NOT_SUPPORTED: Square catalog search not supported (404). Response: ${text}`);
      } else if (resp.status === 403) {
        throw new Error(`CATALOG_FORBIDDEN: Square catalog search forbidden (403): Check your Square app permissions for catalog access. Response: ${text}`);
      } else if (resp.status === 401) {
        throw new Error(`AUTH_FAILED: Square catalog search authentication failed (401): Check your access token validity. Response: ${text}`);
      } else {
        throw new Error(`Square searchCatalog failed: ${resp.status} ${text}`);
      }
    }
    
    const result = await resp.json();
    return {
      objects: result.objects ?? [],
      related_objects: [], // Always empty since include_related_objects is false
      cursor: result.cursor
    };
  }
}

async function batchRetrieveVariations(accessToken: string, baseUrl: string, variationIds: string[]): Promise<any[]> {
  if (variationIds.length === 0) return [];
  
  const url = `${baseUrl}/catalog/batch-retrieve`;
  const chunks = [];
  
  // Chunk variation IDs to avoid hitting API limits
  for (let i = 0; i < variationIds.length; i += MAX_BATCH_RETRIEVE_IDS) {
    chunks.push(variationIds.slice(i, i + MAX_BATCH_RETRIEVE_IDS));
  }
  
  const allVariations = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunks.length > 1) {
      console.log(`🔗 BatchRetrieve ${i + 1}/${chunks.length} (chunk size ${chunk.length})`);
    }
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
        body: JSON.stringify({
          object_ids: chunk,
          include_related_objects: false
        }),
      });
      
      if (resp.status === 429 || resp.status >= 500) {
        await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
        continue;
      }
      
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Square batchRetrieveVariations failed: ${resp.status} ${text}`);
      }
      
      const result = await resp.json();
      allVariations.push(...(result.objects || []));
      break;
    }
  }
  
  return allVariations;
}

// Main import processing logic
async function performImport(integrationId: string, runId: string): Promise<any> {
  // Get integration settings to determine catalog mode
  const integrationSettings = await getIntegrationSettings(integrationId);
  const catalogMode = integrationSettings.catalog_mode || 'SEARCH';
  
  console.log(`Mode: ${catalogMode}`);

  const timeRemaining = () => IMPORT_MAX_SECONDS - (Date.now() - started) / 1000;
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

    const { accessToken, baseUrl } = creds;
    let processedCount = run.processed_count || 0;
    let createdCount = run.created_count || 0;
    let updatedCount = run.updated_count || 0;
    let skippedCount = run.skipped_count || 0;
    let failedCount = run.failed_count || 0;

    console.log("🔄 Starting Per-Page Processing Pipeline...");

    let pageCount = 0;
    let cursor = run.cursor || undefined;

    while (timeRemaining() > 0) {
      pageCount++;
      console.log(`\n📄 Processing page ${pageCount} (cursor: ${cursor || "start"})...`);
      
      const pageStart = Date.now();
      
      // Fetch a page of items from Square based on catalog mode
      let catalogResult: SquareSearchResponse | SquareListResponse;
      let itemsFromPage: any[] = [];
      let relatedObjects: any[] = [];
      
      try {
        if (catalogMode === 'LIST') {
          const listResult = await listCatalog(accessToken, baseUrl, cursor);
          catalogResult = listResult;
          
          // Separate items and variations from the list response
          itemsFromPage = (listResult.objects || []).filter(obj => obj.type === 'ITEM');
          relatedObjects = (listResult.objects || []).filter(obj => obj.type === 'ITEM_VARIATION');
          
        } else {
          // SEARCH mode (default)
          const searchResult = await searchCatalog(accessToken, baseUrl, cursor);
          catalogResult = searchResult;
          itemsFromPage = searchResult.objects || [];
          relatedObjects = [];
        }
      } catch (err: any) {
        console.error(`${catalogMode} catalog failed:`, err.message);
        
        // For search mode, check if it's a 404 and provide helpful error
        if (catalogMode === 'SEARCH' && err.message.includes('404')) {
          await appendError(runId, "SEARCH_NOT_SUPPORTED", "Square catalog search not supported. Enable Square Catalog Search API access or switch integration to LIST mode in settings.");
        } else {
          await appendError(runId, "CATALOG_FETCH_FAILED", err.message);
        }
        throw err;
      }

      if (itemsFromPage.length === 0) {
        console.log("✅ No more items to process");
        break;
      }

      let variations: any[] = [];
      let pageVariationMap: Record<string, any[]> = {};
      
      if (catalogMode === 'LIST') {
        // For LIST mode, build variation map from related_objects
        pageVariationMap = {};
        for (const variation of relatedObjects) {
          if (variation.item_variation_data?.item_id) {
            const itemId = variation.item_variation_data.item_id;
            if (!pageVariationMap[itemId]) {
              pageVariationMap[itemId] = [];
            }
            pageVariationMap[itemId].push(variation);
          }
        }
        console.log(`LIST mode: Found ${relatedObjects.length} variations for ${itemsFromPage.length} items`);
      } else {
        // For SEARCH mode, collect and batch retrieve variations
        const variationIds: string[] = [];
        for (const item of itemsFromPage) {
          if (item.item_data?.variations) {
            for (const variation of item.item_data.variations) {
              if (variation.id) {
                variationIds.push(variation.id);
              }
            }
          }
        }

        console.log(`SEARCH mode: Found ${variationIds.length} variation IDs from ${itemsFromPage.length} items`);

        // Batch retrieve all variations for this page  
        variations = variationIds.length > 0 
          ? await batchRetrieveVariations(accessToken, baseUrl, variationIds)
          : [];
        
        // Build variation map for search mode
        pageVariationMap = {};
        for (const variation of variations) {
          if (variation.item_variation_data?.item_id) {
            const itemId = variation.item_variation_data.item_id;
            if (!pageVariationMap[itemId]) {
              pageVariationMap[itemId] = [];
            }
            pageVariationMap[itemId].push(variation);
          }
        }
      }

      // Process each item with its variations
      for (const item of itemsFromPage) {
        const itemVariations = pageVariationMap[item.id] || [];
        
        if (itemVariations.length > 0) {
          // Item with variations
          for (const variation of itemVariations) {
            try {
              const result = await upsertSingleProduct(
                supabaseAdmin, 
                integrationId, 
                item,
                variation
              );

              if (result.success) {
                if (result.created) {
                  createdCount++;
                } else if (result.updated) {
                  updatedCount++;
                } else if (result.skipped) {
                  skippedCount++;
                }
              } else {
                failedCount++;
                await appendError(runId, result.error?.code || 'VARIATION_UPSERT_FAILED', result.error?.message || 'Failed to upsert variation', {
                  op: 'upsert_variation',
                  sq_item_id: item.id,
                  sq_variation_id: variation.id,
                  detail: result.error?.message
                });
              }
              
            } catch (error: any) {
              console.error(`Failed to process variation:`, error);
              failedCount++;
              await appendError(runId, 'VARIATION_UPSERT_FAILED', `Failed to upsert variation: ${error.message}`, {
                op: 'upsert_variation',
                sq_item_id: item.id,
                sq_variation_id: variation.id,
                detail: error.message
              });
            }
            processedCount++;
          }
        } else {
          // Standalone item (no variations)
          try {
            const result = await upsertSingleProduct(
              supabaseAdmin, 
              integrationId, 
              item,
              null
            );
            
            if (result.success) {
              if (result.created) {
                createdCount++;
              } else if (result.updated) {
                updatedCount++;
              } else if (result.skipped) {
                skippedCount++;
              }
            } else {
              failedCount++;
              await appendError(runId, result.error?.code || 'ITEM_UPSERT_FAILED', result.error?.message || 'Failed to upsert standalone item', {
                op: 'upsert_item',
                sq_item_id: item.id,
                detail: result.error?.message
              });
            }
            
          } catch (error: any) {
            console.error(`Failed to process standalone item:`, error);
            failedCount++;
            await appendError(runId, 'ITEM_UPSERT_FAILED', `Failed to upsert standalone item: ${error.message}`, {
              op: 'upsert_item',
              sq_item_id: item.id,
              detail: error.message
            });
          }
          processedCount++;
        }
      }

      cursor = catalogResult.cursor;
      await updateRun(runId, { 
        cursor,
        processed_count: processedCount,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        failed_count: failedCount,
        status: cursor ? "PARTIAL" : "SUCCESS"
      });

      console.log(`Page ${pageCount}: processed ${itemsFromPage.length} items in ${Date.now() - pageStart}ms`);
      console.log(`Running totals: ${processedCount} processed, ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} failed`);

      if (!cursor) {
        console.log("✅ All pages processed - import complete");
        break;
      }

      // Check if we should yield for time
      if (timeRemaining() <= 5) {
        console.log(`⏰ Time budget reached, yielding with cursor`);
        await updateRun(runId, { status: "PARTIAL" });
        await selfInvoke({ integrationId, mode: "CONTINUE", runId });
        return { ok: true, yielded: true, processed: processedCount };
      }
    }

    const finalStatus = failedCount > 0 && createdCount === 0 && updatedCount === 0 ? "FAILED" : "SUCCESS";
    
    await updateRun(runId, {
      status: finalStatus,
      finished_at: new Date().toISOString(),
    });

    await updateIntegrationLastError(integrationId, null);
    console.log(`✅ Import completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped, ${failedCount} failed`);
    return { 
      ok: true, 
      done: true, 
      processed: processedCount, 
      created: createdCount, 
      updated: updatedCount, 
      skipped: skippedCount,
      failed: failedCount 
    };

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

async function upsertSingleProduct(
  supabaseAdmin: any, 
  integrationId: string, 
  squareItem: any, 
  variation?: any
): Promise<{ success: boolean; created?: boolean; updated?: boolean; skipped?: boolean; error?: any }> {
  const posItemId = squareItem.id;
  const posVariationId = variation?.id || null;
  
  try {
    // 1. Check if we already have a POS link for this item/variation
    let existingProduct = await findProductByPosLink(supabaseAdmin, integrationId, posItemId, posVariationId);
    
    if (existingProduct) {
      // Update existing product
      const extractedData = extractSquareFieldData(squareItem, variation);
      const updateResult = await updateExistingProduct(supabaseAdmin, existingProduct.id, extractedData);
      
      if (updateResult.error) {
        return { 
          success: false, 
          error: { 
            code: 'UPDATE_FAILED', 
            message: updateResult.error.message, 
            pos_item_id: posItemId, 
            pos_variation_id: posVariationId 
          }
        };
      }
      
      // Return skipped if no changes were made
      return { success: true, updated: updateResult.hasChanges, skipped: !updateResult.hasChanges };
    }

    // 2. No existing POS link - try to find by UPC or SKU
    const extractedData = extractSquareFieldData(squareItem, variation);
    
    // Try UPC match first
    if (extractedData.upc) {
      const upcProduct = await findProductByUPC(supabaseAdmin, extractedData.upc);
      if (upcProduct) {
        // Create POS link for UPC match (atomic with conflict resolution)
        const linkResult = await ensurePosLink(supabaseAdmin, upcProduct.id, integrationId, posItemId, posVariationId);
        
        if (!linkResult.success && linkResult.conflictProductId) {
          // Race condition: someone else created the link, use their product instead
          console.log(`Race condition detected: UPC match product ${upcProduct.id} lost to ${linkResult.conflictProductId} for POS ${posItemId}/${posVariationId}`);
          const updateResult = await updateExistingProduct(supabaseAdmin, linkResult.conflictProductId, extractedData);
          return { success: true, updated: updateResult.hasChanges, skipped: !updateResult.hasChanges };
        }
        
        if (!linkResult.success) {
          return { 
            success: false, 
            error: { 
              code: 'LINK_CREATE_FAILED', 
              message: linkResult.error?.message || 'Failed to create POS link', 
              pos_item_id: posItemId, 
              pos_variation_id: posVariationId 
            }
          };
        }
        
        // Update the product
        const updateResult = await updateExistingProduct(supabaseAdmin, upcProduct.id, extractedData);
        if (updateResult.error) {
          return { 
            success: false, 
            error: { 
              code: 'UPDATE_FAILED', 
              message: updateResult.error.message, 
              pos_item_id: posItemId, 
              pos_variation_id: posVariationId 
            }
          };
        }
        
        return { success: true, updated: updateResult.hasChanges, skipped: !updateResult.hasChanges };
      }
    }

    // Try SKU match
    if (extractedData.sku) {
      const skuProduct = await findProductBySKU(supabaseAdmin, extractedData.sku);
      if (skuProduct) {
        // Create POS link for SKU match (atomic with conflict resolution)
        const linkResult = await ensurePosLink(supabaseAdmin, skuProduct.id, integrationId, posItemId, posVariationId);
        
        if (!linkResult.success && linkResult.conflictProductId) {
          // Race condition: someone else created the link, use their product instead
          console.log(`Race condition detected: SKU match product ${skuProduct.id} lost to ${linkResult.conflictProductId} for POS ${posItemId}/${posVariationId}`);
          const updateResult = await updateExistingProduct(supabaseAdmin, linkResult.conflictProductId, extractedData);
          return { success: true, updated: updateResult.hasChanges, skipped: !updateResult.hasChanges };
        }
        
        if (!linkResult.success) {
          return { 
            success: false, 
            error: { 
              code: 'LINK_CREATE_FAILED', 
              message: linkResult.error?.message || 'Failed to create POS link', 
              pos_item_id: posItemId, 
              pos_variation_id: posVariationId 
            }
          };
        }
        
        // Update the product
        const updateResult = await updateExistingProduct(supabaseAdmin, skuProduct.id, extractedData);
        if (updateResult.error) {
          return { 
            success: false, 
            error: { 
              code: 'UPDATE_FAILED', 
              message: updateResult.error.message, 
              pos_item_id: posItemId, 
              pos_variation_id: posVariationId 
            }
          };
        }
        
        return { success: true, updated: updateResult.hasChanges, skipped: !updateResult.hasChanges };
      }
    }

    // 3. No match found - create new product atomically
    const { data: newProduct, error: createError } = await createNewProduct(supabaseAdmin, extractedData);
    
    if (createError) {
      return { 
        success: false, 
        error: { 
          code: 'CREATE_FAILED', 
          message: createError.message, 
          pos_item_id: posItemId, 
          pos_variation_id: posVariationId 
        }
      };
    }

    // 4. Create POS link for new product (atomic with race condition handling)
    const linkResult = await ensurePosLink(supabaseAdmin, newProduct.id, integrationId, posItemId, posVariationId);
    
    if (!linkResult.success && linkResult.conflictProductId) {
      // Race condition: someone else created the link while we were creating the product
      // Delete our just-created product and use the canonical one instead
      console.log(`Race condition detected: Created product ${newProduct.id} lost to ${linkResult.conflictProductId} for POS ${posItemId}/${posVariationId}, cleaning up`);
      
      await supabaseAdmin.from('products').delete().eq('id', newProduct.id);
      
      const updateResult = await updateExistingProduct(supabaseAdmin, linkResult.conflictProductId, extractedData);
      return { success: true, updated: updateResult.hasChanges, skipped: !updateResult.hasChanges };
    }
    
    if (!linkResult.success) {
      // Clean up the orphaned product
      await supabaseAdmin.from('products').delete().eq('id', newProduct.id);
      
      return { 
        success: false, 
        error: { 
          code: 'LINK_CREATE_FAILED', 
          message: linkResult.error?.message || 'Failed to create POS link', 
          pos_item_id: posItemId, 
          pos_variation_id: posVariationId 
        }
      };
    }
    
    return { success: true, created: true };

  } catch (error: any) {
    return { 
      success: false, 
      error: { 
        code: 'UNEXPECTED_ERROR', 
        message: error.message, 
        pos_item_id: posItemId, 
        pos_variation_id: posVariationId 
      }
    };
  }
}

// Helper function to extract and normalize Square field data
function extractSquareFieldData(item: any, variation?: any) {
  // Extract name
  const name = (variation?.item_variation_data?.name || item?.item_data?.name || `Square Item ${item?.id}`)?.trim();
  
  // Extract and normalize SKU
  let sku = variation?.item_variation_data?.sku || item?.item_data?.sku || null;
  sku = sku?.trim() || null;
  if (sku === '') sku = null;
  
  // Extract and normalize UPC  
  let upc = variation?.item_variation_data?.upc || item?.item_data?.upc || null;
  upc = upc?.trim() || null;
  if (upc === '') upc = null;
  
  // Extract pricing info with enhanced logging
  let retailPriceCents: number | null = null;
  let currencyCode = 'USD';
  let priceSource = 'NONE';
  
  if (variation?.item_variation_data?.price_money?.amount) {
    retailPriceCents = parseInt(variation.item_variation_data.price_money.amount, 10);
    currencyCode = variation.item_variation_data.price_money.currency || 'USD';
    priceSource = 'VARIATION';
  } else if (ALLOW_ITEM_PRICE_FALLBACK && item?.item_data?.variations?.[0]?.item_variation_data?.price_money?.amount) {
    retailPriceCents = parseInt(item.item_data.variations[0].item_variation_data.price_money.amount, 10);
    currencyCode = item.item_data.variations[0].item_variation_data.price_money.currency || 'USD';
    priceSource = 'ITEM_FALLBACK';
  } else if (variation?.item_variation_data?.price_money === null || variation?.item_variation_data?.price_money === undefined) {
    priceSource = 'VARIABLE_PRICE';
  }
  
  // Log price extraction for debugging
  if (priceSource === 'NONE' && variation) {
    console.log(`⚠️ No price found for variation ${variation.id}, variation price_money:`, variation.item_variation_data?.price_money);
  }
  
  return { 
    name, 
    sku, 
    upc, 
    retail_price_cents: retailPriceCents, 
    currency_code: currencyCode, 
    priceSource,
    // Mirror UPC to barcode when creating products
    barcode: upc 
  };
}

// Helper function to find product by POS link
async function findProductByPosLink(supabaseAdmin: any, integrationId: string, itemId: string, variationId: string | null) {
  let query = supabaseAdmin
    .from('product_pos_links')
    .select('product_id, products!inner(*)')
    .eq('integration_id', integrationId)
    .eq('source', 'SQUARE')
    .eq('pos_item_id', itemId);

  if (variationId) {
    query = query.eq('pos_variation_id', variationId);
  } else {
    query = query.is('pos_variation_id', null); // Use .is() for proper NULL handling
  }

  const { data, error } = await query.maybeSingle(); // Use maybeSingle to avoid errors
  
  if (error) {
    throw error;
  }

  return data?.products || null;
}

// Helper function to find product by UPC
async function findProductByUPC(supabase: any, upc: string) {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('upc', upc)
    .eq('catalog_status', 'ACTIVE')
    .maybeSingle();
    
  return data;
}

// Helper function to find product by SKU
async function findProductBySKU(supabase: any, sku: string) {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .eq('catalog_status', 'ACTIVE')
    .maybeSingle();
    
  return data;
}

// Helper function to update existing product with change detection
async function updateExistingProduct(supabaseAdmin: any, productId: string, extractedData: any): Promise<{ error?: any; hasChanges: boolean }> {
  try {
    // First, get the current product to compare changes
    const { data: currentProduct, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('name, sku, upc, barcode, retail_price_cents, currency_code, origin, sync_state')
      .eq('id', productId)
      .maybeSingle();
    
    if (fetchError) {
      return { error: fetchError, hasChanges: false };
    }
    
    if (!currentProduct) {
      return { error: { message: 'Product not found' }, hasChanges: false };
    }
    
    const updateData: any = {
      origin: 'SQUARE',
      sync_state: 'SYNCED'
    };
    
    let hasChanges = false;
    
    // Only update name if incoming is better (longer, more descriptive)
    if (extractedData.name && (
      !currentProduct.name || 
      currentProduct.name === 'Unnamed Item' ||
      extractedData.name.length > currentProduct.name.length
    )) {
      updateData.name = extractedData.name;
      hasChanges = true;
    }
    
    // Never overwrite non-empty SKU with empty/null
    if (extractedData.sku && (!currentProduct.sku || currentProduct.sku !== extractedData.sku)) {
      updateData.sku = extractedData.sku;
      hasChanges = true;
    }
    
    // Never overwrite non-empty UPC with empty/null, handle conflicts gracefully
    if (extractedData.upc && (!currentProduct.upc || currentProduct.upc !== extractedData.upc)) {
      updateData.upc = extractedData.upc;
      hasChanges = true;
    }
    
    // Mirror UPC to barcode when safe (barcode is empty or matches old UPC)
    if (extractedData.upc && (
      !currentProduct.barcode || 
      currentProduct.barcode === '' ||
      currentProduct.barcode === currentProduct.upc
    )) {
      updateData.barcode = extractedData.upc;
      hasChanges = true;
      console.log(`🔗 Mirroring UPC to barcode: ${extractedData.upc}`);
    }
    
    // Update price and currency if provided
    if (extractedData.retail_price_cents !== null && extractedData.retail_price_cents !== currentProduct.retail_price_cents) {
      updateData.retail_price_cents = extractedData.retail_price_cents;
      hasChanges = true;
    }
    if (extractedData.currency_code && extractedData.currency_code !== currentProduct.currency_code) {
      updateData.currency_code = extractedData.currency_code;
      hasChanges = true;
    }
    
    // Always update origin and sync_state (these don't count as "real" changes)
    if (currentProduct.origin !== 'SQUARE') {
      updateData.origin = 'SQUARE';
    }
    if (currentProduct.sync_state !== 'SYNCED') {
      updateData.sync_state = 'SYNCED';
    }
    
    if (!hasChanges) {
      // Still update origin/sync_state if needed, but don't count as changes
      const metadataUpdate: any = {};
      if (currentProduct.origin !== 'SQUARE') metadataUpdate.origin = 'SQUARE';
      if (currentProduct.sync_state !== 'SYNCED') metadataUpdate.sync_state = 'SYNCED';
      
      if (Object.keys(metadataUpdate).length > 0) {
        await supabaseAdmin
          .from('products')
          .update(metadataUpdate)
          .eq('id', productId);
      }
      
      return { hasChanges: false };
    }

    const { error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId);

    if (error) {
      // Handle UPC conflict specifically
      if (error.code === '23505' && error.message?.includes('upc')) {
        console.log(`⚠️ UPC_CONFLICT: Product ${productId}, UPC: ${extractedData.upc}`);
        
        // Retry update without UPC to avoid blocking the whole process
        const { upc, ...updateDataWithoutUpc } = updateData;
        const { error: retryError } = await supabaseAdmin
          .from('products')
          .update(updateDataWithoutUpc)
          .eq('id', productId);
          
        if (retryError) {
          return { error: retryError, hasChanges: false };
        }
        
        return { hasChanges: true };
      }
      return { error, hasChanges: false };
    }

    return { hasChanges: true };
  } catch (error) {
    return { error, hasChanges: false };
  }
}

async function createNewProduct(supabaseAdmin: any, extractedData: any): Promise<{ data: any; error: any }> {
  const productData = {
    name: extractedData.name,
    sku: extractedData.sku,
    upc: extractedData.upc,
    barcode: extractedData.upc, // Mirror UPC to barcode on creation
    retail_price_cents: extractedData.retailPriceCents,
    currency_code: extractedData.currencyCode,
    origin: 'SQUARE',
    sync_state: 'SYNCED',
    catalog_status: 'ACTIVE'
  };
  
  try {
    const { data: newProduct, error: insertError } = await supabaseAdmin
      .from('products')
      .insert([productData])
      .select()
      .single();
      
    if (insertError) {
      // Handle UPC conflict specifically
      if (insertError.code === '23505' && insertError.message?.includes('upc')) {
        console.log(`⚠️ UPC_CONFLICT: Cannot create product with UPC ${extractedData.upc} - already exists`);
        // Note: appendError would need runId parameter which isn't available in this context
        throw new Error(`UPC conflict: ${extractedData.upc} already exists. Product creation skipped.`);
      }
      
      console.error(`Failed to create product:`, insertError);
      // Note: appendError would need runId parameter which isn't available in this context
      throw insertError;
    }
    
    console.log(`✅ Created new product: ${newProduct.id}`);
    return newProduct.id;
  } catch (error) {
    throw error;
  }
}

async function ensurePosLink(
  supabase: any,
  productId: string,
  integrationId: string,
  squareItemId: string,
  squareVariationId?: string | null
): Promise<{ success: boolean; conflictProductId?: string; error?: any }> {
  try {
    const linkData: any = {
      product_id: productId,
      integration_id: integrationId,
      source: 'SQUARE',
      pos_item_id: squareItemId,
      pos_variation_id: squareVariationId || null
    };
    
    const { error } = await supabase
      .from('product_pos_links')
      .insert([linkData]);
      
    if (error && error.code !== '23505') { // Ignore unique constraint violations (link already exists)
      console.error(`Failed to create POS link for product ${productId}:`, error);
      return { success: false, error };
    }
    
    if (error?.code === '23505') {
      // Handle conflict - find existing product with this POS link
      const { data: existingLink } = await supabase
        .from('product_pos_links')
        .select('product_id')
        .eq('integration_id', integrationId)
        .eq('pos_item_id', squareItemId)
        .eq('pos_variation_id', squareVariationId || null)
        .single();
        
      if (existingLink && existingLink.product_id !== productId) {
        console.log(`ℹ️ Link conflict - existing product ${existingLink.product_id} for POS link`);
        return { success: false, conflictProductId: existingLink.product_id };
      }
      
      console.log(`ℹ️ Link already exists for product ${productId} (idempotent)`);
      return { success: true };
    } else {
      console.log(`✅ Created POS link for product ${productId}`);
      return { success: true };
    }
  } catch (error) {
    console.error(`Error ensuring POS link:`, error);
    return { success: false, error };
  }
}