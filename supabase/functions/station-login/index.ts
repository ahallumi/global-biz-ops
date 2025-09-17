// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

/** ======== CONFIG (single source of truth) ======== */
const FN_SLUG = "/station-login";
const COOKIE_NAME = "station_session";
const COOKIE_SAMESITE: "Lax" | "None" = "None"; // use "Lax" if your app and functions share the same origin

/** ======== CORS helpers (always used) ======== */
function resolveOrigin(req: Request) {
  const o = req.headers.get("origin");
  if (o) return o;
  const ref = req.headers.get("referer");
  if (ref) {
    try {
      return new URL(ref).origin;
    } catch {}
  }
  return new URL(req.url).origin;
}
function corsHeaders(req: Request) {
  const o = resolveOrigin(req);
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Vary": "Origin",
  };
}
function jsonRes(req: Request, status: number, body: unknown, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req), ...(extra ?? {}) },
  });
}
function emptyRes(req: Request, status = 204, extra?: Record<string, string>) {
  return new Response(null, { status, headers: { ...corsHeaders(req), ...(extra ?? {}) } });
}

/** ======== Path normalization (handles /functions/v1 + slug anywhere) ======== */
function normalizePath(req: Request) {
  let p = new URL(req.url).pathname;
  // strip Supabase prefix
  p = p.replace(/^\/functions\/v1/, "");
  // find slug anywhere in path
  const i = p.indexOf(FN_SLUG);
  if (i >= 0) p = p.slice(i + FN_SLUG.length) || "/";
  if (p === "") p = "/";
  return p;
}

/** ======== Cookie helpers ======== */
function getCookie(req: Request, name: string) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]).replace(/^"(.*)"$/, "$1") : null;
}
function makeCookie(name: string, value: string, opts: { maxAge?: number; sameSite?: "Lax" | "None" } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure", // required on https
    `SameSite=${opts.sameSite ?? COOKIE_SAMESITE}`,
  ];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

/** ======== Key/secret helpers ======== */
async function importHmacKey(secret: string) {
  const raw = new TextEncoder().encode(secret);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function secretHash16(secret: string) {
  const raw = new TextEncoder().encode(secret);
  const h = await crypto.subtle.digest("SHA-256", raw);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** ======== Main ======== */
serve(async (req) => {
  if (req.method === "OPTIONS") return emptyRes(req);

  const path = normalizePath(req);
  const method = req.method;

  // DEBUG: secret hash
  if (method === "GET" && path === "/__secret-hash") {
    const s = Deno.env.get("STATION_JWT_SECRET") || "";
    if (!s) return jsonRes(req, 500, { error: "server_error", reason: "missing_secret" });
    return jsonRes(req, 200, { secret_hash: await secretHash16(s) });
  }

  // DEBUG: whoami (shows what server sees for tokens & path)
  if (method === "GET" && path === "/__whoami") {
    const s = Deno.env.get("STATION_JWT_SECRET") || "";
    const key = s ? await importHmacKey(s) : null;

    const cookieToken = getCookie(req, COOKIE_NAME);
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    let via: "cookie" | "bearer" | "none" = "none";
    let payload: any = null;
    const errors: Record<string, string> = {};

    if (cookieToken && key) {
      try {
        payload = await verify(cookieToken, key, "HS256");
        via = "cookie";
      } catch (e) {
        errors.cookie = String(e?.message || e);
      }
    }
    if (via === "none" && bearer && key) {
      try {
        payload = await verify(bearer, key, "HS256");
        via = "bearer";
      } catch (e) {
        errors.bearer = String(e?.message || e);
      }
    }

    return jsonRes(req, 200, {
      method,
      raw_path: new URL(req.url).pathname,
      normalized_path: path,
      has_cookie: !!cookieToken,
      has_bearer: !!bearer,
      via,
      payload: payload ? { role: payload.role, sub: payload.sub, default_page: payload.default_page } : null,
      errors,
    });
  }

  // DEBUG: quick env presence check
  if (method === "GET" && path === "/__env") {
    const url = !!Deno.env.get("SUPABASE_URL");
    const key = !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sec = Deno.env.get("STATION_JWT_SECRET") || "";
    const hash = sec ? await secretHash16(sec) : null;
    return jsonRes(req, 200, { has_url: url, has_service_key: key, has_secret: !!sec, secret_hash: hash });
  }

  // DEBUG: test mint token (dev only)
  if (method === "GET" && path === "/__mint" && Deno.env.get("ALLOW_TEST_MINT") === "1") {
    const secret = Deno.env.get("STATION_JWT_SECRET");
    if (!secret) return jsonRes(req, 500, { error: "server_error", reason: "missing_secret" });
    const key = await importHmacKey(secret);
    const payload = {
      sub: "test",
      role: "kiosk",
      allowed_paths: ["/station", "/station/clock"],
      default_page: "/station/clock",
      iat: Math.floor(Date.now()/1000),
      exp: Math.floor(Date.now()/1000) + 3600,
    };
    const token = await create({ alg: "HS256", typ: "JWT" }, payload as any, key);
    return jsonRes(req, 200, { token });
  }

  // LOGIN: POST /
  if (method === "POST" && path === "/") {
    try {
      const body = await req.json().catch(() => ({}));
      const rawCode = typeof body?.code === "string" ? body.code : "";
      console.log("LOGIN: start", { rawCode });

      // robust normalization (handles pasted spaces/dashes/mixed case)
      const code = rawCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (!code) return jsonRes(req, 400, { error: "Access code is required" });

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!supabaseUrl || !serviceKey) {
        console.log("LOGIN: missing env", { hasUrl: !!supabaseUrl, hasKey: !!serviceKey });
        return jsonRes(req, 500, { error: "Server configuration error" });
      }

      const getOne = async (table: string) => {
        const url = `${supabaseUrl}/rest/v1/${table}?select=*&code=eq.${encodeURIComponent(code)}&limit=1`;
        const r = await fetch(url, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" },
        });
        const txt = await r.text();
        let json: any = null;
        try { json = txt ? JSON.parse(txt) : null; } catch {}
        console.log("LOGIN: rest", { table, status: r.status, body: txt?.slice(0, 200) });
        if (!r.ok) return { ok: false as const, data: null };
        if (Array.isArray(json) && json.length > 0) return { ok: true as const, data: json[0] };
        return { ok: false as const, data: null };
      };

      // Try both table names (whichever you actually use)
      let rec: any = null;
      let r = await getOne("station_login_codes");
      if (r.ok) rec = r.data; else {
        r = await getOne("station_access_codes");
        if (r.ok) rec = r.data;
      }
      if (!rec) {
        console.log("LOGIN: code not found after normalization", { code });
        return jsonRes(req, 401, { error: "Invalid access code", reason: "not_found" });
      }

      if (rec.expires_at && new Date(rec.expires_at) < new Date()) {
        console.log("LOGIN: expired", rec.expires_at);
        return jsonRes(req, 401, { error: "Access code has expired", reason: "expired" });
      }
      if (rec.is_active === false) {
        console.log("LOGIN: disabled");
        return jsonRes(req, 403, { error: "Access code is disabled", reason: "disabled" });
      }

      // Sign JWT
      const secret = Deno.env.get("STATION_JWT_SECRET") || "";
      if (!secret) {
        console.log("LOGIN: missing secret");
        return jsonRes(req, 500, { error: "Server configuration error: missing secret" });
      }
      const key = await importHmacKey(secret);
      const payload = {
        sub: String(rec.id ?? rec.station_id ?? code),
        role: rec.role ?? "kiosk",
        allowed_paths: rec.allowed_paths ?? [],
        default_page: rec.default_page ?? "/station",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      };

      const token = await create({ alg: "HS256", typ: "JWT" }, payload as Record<string, unknown>, key);

      // Cookie + response
      const cookie = makeCookie(COOKIE_NAME, token, { sameSite: COOKIE_SAMESITE });
      console.log("LOGIN: success", { sub: payload.sub, default_page: payload.default_page });

      return jsonRes(
        req,
        200,
        { success: true, token, redirectTo: payload.default_page },
        { "Set-Cookie": cookie },
      );
    } catch (e) {
      console.error("LOGIN: server_error", e);
      return jsonRes(req, 500, { error: "server_error", detail: String(e?.message || e) });
    }
  }

  // SESSION: GET/POST /station-session  (cookie first, then bearer)
  if ((method === "GET" || method === "POST") && path === "/station-session") {
    const secret = Deno.env.get("STATION_JWT_SECRET");
    if (!secret) return jsonRes(req, 500, { ok: false, reason: "server_error" });
    const key = await importHmacKey(secret);

    const cookieToken = getCookie(req, COOKIE_NAME);
    if (cookieToken) {
      try {
        const p: any = await verify(cookieToken, key, "HS256");
        return jsonRes(req, 200, {
          ok: true,
          via: "cookie",
          role: p.role,
          allowed_paths: p.allowed_paths ?? [],
          default_page: p.default_page,
        });
      } catch (e) {
        // fall through to bearer
      }
    }

    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (bearer && bearer.length > 20) {
      try {
        const p: any = await verify(bearer, key, "HS256");
        return jsonRes(req, 200, {
          ok: true,
          via: "bearer",
          role: p.role,
          allowed_paths: p.allowed_paths ?? [],
          default_page: p.default_page,
        });
      } catch (e) {
        return jsonRes(req, 401, { ok: false, reason: "invalid_token" });
      }
    }

    return jsonRes(req, 401, { ok: false, reason: cookieToken ? "invalid_token" : "missing_token" });
  }

  // LOGOUT: POST /station-logout
  if (method === "POST" && path === "/station-logout") {
    const expired = makeCookie(COOKIE_NAME, "", { sameSite: COOKIE_SAMESITE, maxAge: 0 });
    return jsonRes(req, 200, { success: true }, { "Set-Cookie": expired });
  }

  // ADMIN route: POST /generate-station-code
  if (method === "POST" && path === "/generate-station-code") {
    try {
      // Check authentication first
      const secret = Deno.env.get("STATION_JWT_SECRET");
      if (!secret) return jsonRes(req, 500, { error: "server_error", reason: "missing_secret" });
      
      const key = await importHmacKey(secret);
      const auth = req.headers.get("authorization") || "";
      const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      
      if (!bearer) {
        return jsonRes(req, 401, { error: "unauthorized", reason: "missing_token" });
      }
      
      let payload: any = null;
      try {
        payload = await verify(bearer, key, "HS256");
      } catch (e) {
        return jsonRes(req, 401, { error: "unauthorized", reason: "invalid_token" });
      }
      
      // Check if user has admin role (assuming admin role is required)
      if (payload.role !== "admin") {
        return jsonRes(req, 403, { error: "forbidden", reason: "insufficient_permissions" });
      }
      
      // Parse and validate request body
      const body = await req.json().catch(() => ({}));
      const { label, role = "station", expires_at, allowed_paths = ["/station"], default_page = "/station" } = body;
      
      if (!label || typeof label !== "string") {
        return jsonRes(req, 400, { error: "validation_error", reason: "label_required" });
      }
      
      // Generate secure 12-character alphanumeric code
      const generateCode = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 12; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      
      const code = generateCode();
      console.log("GENERATE_CODE: creating", { code, label, role });
      
      // Prepare data for insertion
      const newRecord = {
        code,
        label,
        role,
        is_active: true,
        allowed_paths: Array.isArray(allowed_paths) ? allowed_paths : ["/station"],
        default_page: default_page || "/station",
        created_by: payload.sub,
        created_at: new Date().toISOString(),
      };
      
      if (expires_at) {
        newRecord.expires_at = expires_at;
      }
      
      // Insert into database
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      
      if (!supabaseUrl || !serviceKey) {
        console.log("GENERATE_CODE: missing env", { hasUrl: !!supabaseUrl, hasKey: !!serviceKey });
        return jsonRes(req, 500, { error: "server_error", reason: "missing_config" });
      }
      
      const insertUrl = `${supabaseUrl}/rest/v1/station_login_codes`;
      const insertResponse = await fetch(insertUrl, {
        method: "POST",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify(newRecord)
      });
      
      const insertText = await insertResponse.text();
      console.log("GENERATE_CODE: insert response", { status: insertResponse.status, body: insertText?.slice(0, 200) });
      
      if (!insertResponse.ok) {
        let errorReason = "database_error";
        if (insertResponse.status === 409) {
          errorReason = "code_collision"; // extremely unlikely with 12 chars
        }
        return jsonRes(req, insertResponse.status, { 
          error: "database_error", 
          reason: errorReason,
          detail: insertText 
        });
      }
      
      let insertedRecord;
      try {
        const parsed = JSON.parse(insertText);
        insertedRecord = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch (e) {
        console.error("GENERATE_CODE: parse error", e);
        return jsonRes(req, 500, { error: "server_error", reason: "response_parse_error" });
      }
      
      console.log("GENERATE_CODE: success", { id: insertedRecord?.id, code });
      
      return jsonRes(req, 201, {
        success: true,
        code: {
          id: insertedRecord.id,
          code: insertedRecord.code,
          label: insertedRecord.label,
          role: insertedRecord.role,
          is_active: insertedRecord.is_active,
          expires_at: insertedRecord.expires_at,
          allowed_paths: insertedRecord.allowed_paths,
          default_page: insertedRecord.default_page,
          created_at: insertedRecord.created_at
        }
      });
      
    } catch (e) {
      console.error("GENERATE_CODE: server_error", e);
      return jsonRes(req, 500, { error: "server_error", detail: String(e?.message || e) });
    }
  }

  // 404 fallback (with CORS)
  return jsonRes(req, 404, { error: "not_found", method, path, raw: new URL(req.url).pathname });
});