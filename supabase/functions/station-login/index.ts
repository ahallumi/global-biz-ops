// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method === "OPTIONS") {
    console.log("CORS preflight", { origin: resolveOrigin(req), path: new URL(req.url).pathname, headers: Array.from(req.headers.keys()) });
    return emptyRes(req);
  }

  const path = normalizePath(req);
  const method = req.method;

  console.log("REQ", { method, path, origin: resolveOrigin(req), raw_path: new URL(req.url).pathname, hasCookie: !!getCookie(req, COOKIE_NAME), hasAuth: !!req.headers.get("authorization") });

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
        console.log("SESSION: invalid bearer token", { error: String(e?.message || e) });
        return jsonRes(req, 401, { ok: false, reason: "invalid_token" });
      }
    }

    console.log("SESSION: 401", { hasCookie: !!cookieToken, hasBearer: !!bearer, reason: cookieToken ? "invalid_token" : "missing_token" });
    return jsonRes(req, 401, { ok: false, reason: cookieToken ? "invalid_token" : "missing_token" });
  }

  // LOGOUT: POST /station-logout
  if (method === "POST" && path === "/station-logout") {
    const expired = makeCookie(COOKIE_NAME, "", { sameSite: COOKIE_SAMESITE, maxAge: 0 });
    return jsonRes(req, 200, { success: true }, { "Set-Cookie": expired });
  }

  // REFRESH: POST /refresh (refresh station permissions)
  if (method === "POST" && path === "/refresh") {
    const secret = Deno.env.get("STATION_JWT_SECRET");
    if (!secret) return jsonRes(req, 500, { error: "server_error", reason: "missing_secret" });
    const key = await importHmacKey(secret);

    // Try to get current token (Bearer first, then cookie)
    let currentToken = "";
    let via: "bearer" | "cookie" = "bearer";
    
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (bearer) {
      currentToken = bearer;
    } else {
      const cookieToken = getCookie(req, COOKIE_NAME);
      if (cookieToken) {
        currentToken = cookieToken;
        via = "cookie";
      }
    }

    if (!currentToken) {
      return jsonRes(req, 401, { error: "missing_token", reason: "no_token_provided" });
    }

    // Verify current token and extract sub (code ID)
    let payload: any;
    try {
      payload = await verify(currentToken, key, "HS256");
    } catch (e) {
      console.log("REFRESH: invalid token", { error: String(e?.message || e) });
      return jsonRes(req, 401, { error: "invalid_token", reason: "token_verification_failed" });
    }

    const codeId = payload.sub;
    console.log("REFRESH: start", { codeId, via });

    // Fetch fresh station login code data
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return jsonRes(req, 500, { error: "server_error", reason: "missing_config" });
    }

    const getById = async (table: string, id: string) => {
      const url = `${supabaseUrl}/rest/v1/${table}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`;
      const r = await fetch(url, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" },
      });
      const txt = await r.text();
      let json: any = null;
      try { json = txt ? JSON.parse(txt) : null; } catch {}
      console.log("REFRESH: rest", { table, status: r.status, body: txt?.slice(0, 200) });
      if (!r.ok) return { ok: false as const, data: null };
      if (Array.isArray(json) && json.length > 0) return { ok: true as const, data: json[0] };
      return { ok: false as const, data: null };
    };

    // Try both table names
    let rec: any = null;
    let r = await getById("station_login_codes", codeId);
    if (r.ok) rec = r.data; else {
      r = await getById("station_access_codes", codeId);
      if (r.ok) rec = r.data;
    }

    if (!rec) {
      console.log("REFRESH: code not found", { codeId });
      return jsonRes(req, 404, { error: "code_not_found", reason: "station_code_missing" });
    }

    // Validate code is still active and not expired
    if (rec.expires_at && new Date(rec.expires_at) < new Date()) {
      console.log("REFRESH: expired", rec.expires_at);
      return jsonRes(req, 401, { error: "code_expired", reason: "expired" });
    }
    if (rec.is_active === false) {
      console.log("REFRESH: disabled");
      return jsonRes(req, 403, { error: "code_disabled", reason: "disabled" });
    }

    // Create new JWT with fresh permissions
    const newPayload = {
      sub: String(rec.id ?? rec.station_id ?? codeId),
      role: rec.role ?? "kiosk",
      allowed_paths: rec.allowed_paths ?? [],
      default_page: rec.default_page ?? "/station",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    };

    const newToken = await create({ alg: "HS256", typ: "JWT" }, newPayload as Record<string, unknown>, key);

    // Set new cookie and return token
    const cookie = makeCookie(COOKIE_NAME, newToken, { sameSite: COOKIE_SAMESITE });
    console.log("REFRESH: success", { sub: newPayload.sub, allowed_paths: newPayload.allowed_paths });

    return jsonRes(
      req,
      200,
      { success: true, token: newToken, allowed_paths: newPayload.allowed_paths, role: newPayload.role },
      { "Set-Cookie": cookie },
    );
  }

  // ADMIN route: POST /generate-station-code
  if (method === "POST" && path === "/generate-station-code") {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      if (!supabaseUrl || !anonKey) {
        return jsonRes(req, 500, { error: "server_error", reason: "missing_config" });
      }

      const authHeader = req.headers.get("authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return jsonRes(req, 401, { error: "unauthorized", reason: "missing_token" });
      }

      // Create a Supabase client scoped to the caller's JWT so RLS applies
      const supabase = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        return jsonRes(req, 401, { error: "unauthorized", reason: "invalid_token" });
      }

      // Fetch employee role for the current user
      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (empErr) {
        return jsonRes(req, 500, { error: "server_error", reason: "employee_lookup_failed", detail: empErr.message });
      }

      if (!emp || emp.role !== "admin") {
        return jsonRes(req, 403, { error: "forbidden", reason: "insufficient_permissions" });
      }

      // Parse and validate request body
      const body = await req.json().catch(() => ({}));
      const label = typeof body?.label === "string" && body.label.length > 0 ? body.label : null;
      const role = typeof body?.role === "string" ? body.role : "station";
      const allowed_paths = Array.isArray(body?.allowed_paths) && body.allowed_paths.length > 0 ? body.allowed_paths : ["/station"];
      const default_page = typeof body?.default_page === "string" ? body.default_page : "/station";
      const expires_at = body?.expires_at ? new Date(body.expires_at).toISOString() : null;

      // Generate secure 12-character alphanumeric code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const genCode = (len: number) => {
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        let out = "";
        for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
        return out;
      };
      const code = genCode(12);
      console.log("GENERATE_CODE: creating", { code, label, role, user_id: user.id });

      const insertPayload: Record<string, any> = {
        code,
        label,
        role,
        is_active: true,
        allowed_paths,
        default_page,
        created_by: user.id,
        created_at: new Date().toISOString(),
      };
      if (expires_at) insertPayload.expires_at = expires_at;

      // Insert with RLS enforced (admin required by policy)
      const { data: inserted, error: insErr, status } = await supabase
        .from("station_login_codes")
        .insert(insertPayload)
        .select("*")
        .single();

      if (insErr) {
        return jsonRes(req, 400, { error: "database_error", detail: insErr.message, status });
      }

      console.log("GENERATE_CODE: success", { id: inserted?.id, code });
      return jsonRes(req, 201, { success: true, code: inserted });
    } catch (e) {
      console.error("GENERATE_CODE: server_error", e);
      return jsonRes(req, 500, { error: "server_error", detail: String(e?.message || e) });
    }
  }

  // 404 fallback (with CORS)
  return jsonRes(req, 404, { error: "not_found", method, path, raw: new URL(req.url).pathname });
});