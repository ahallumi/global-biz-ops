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

  // LOGIN: POST /
  if (method === "POST" && path === "/") {
    try {
      const { code } = await req.json().catch(() => ({}));
      if (!code) return jsonRes(req, 400, { error: "Access code is required" });

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.46.1");
      const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

      // look up your code record (adjust table/columns if needed)
      const { data: codeData, error } = await client
        .from("station_login_codes")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (error || !codeData) return jsonRes(req, 401, { error: "Invalid access code" });
      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        return jsonRes(req, 401, { error: "Access code has expired" });
      }
      if (codeData.is_active === false) return jsonRes(req, 403, { error: "Access code is disabled" });

      const secret = Deno.env.get("STATION_JWT_SECRET");
      if (!secret) return jsonRes(req, 500, { error: "Server configuration error: missing secret" });
      const key = await importHmacKey(secret);

      const payload = {
        sub: String(codeData.id),
        role: codeData.role ?? "kiosk",
        allowed_paths: codeData.allowed_paths ?? [],
        default_page: codeData.default_page ?? "/station",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h
      };

      const token = await create({ alg: "HS256", typ: "JWT" }, payload as Record<string, unknown>, key);

      const cookie = makeCookie(COOKIE_NAME, token, { sameSite: COOKIE_SAMESITE });
      return jsonRes(req, 200, { success: true, token, redirectTo: payload.default_page }, { "Set-Cookie": cookie });
    } catch (e) {
      console.error("login error:", e);
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

  // (optional) ADMIN route: /generate-station-code — remember to jsonRes(req,...)

  // 404 fallback (with CORS)
  return jsonRes(req, 404, { error: "not_found", method, path, raw: new URL(req.url).pathname });
});