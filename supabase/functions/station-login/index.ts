import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const JWT_SECRET = Deno.env.get("STATION_JWT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const COOKIE_NAME = "station_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Utility to resolve origin from request headers
function resolveOrigin(req: Request): string {
  // Prefer Origin header; fall back to Referer (for same-site), then function URL's own origin
  const origin = req.headers.get("origin");
  if (origin) return origin;
  
  const referer = req.headers.get("referer");
  if (referer) {
    try { 
      return new URL(referer).origin; 
    } catch {}
  }
  
  return new URL(req.url).origin;
}

// CORS headers that automatically reflect the request origin
function corsHeadersFor(req: Request) {
  const origin = resolveOrigin(req);
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Vary": "Origin",
  };
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// JSON response with automatic CORS handling
function jsonRes(req: Request, status: number, body: unknown, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
      "Content-Type": "application/json", 
      ...corsHeadersFor(req), 
      ...(extra ?? {}) 
    },
  });
}

// Empty CORS response (for OPTIONS, etc.)
function emptyCors(req: Request, status = 204, extra?: Record<string, string>) {
  return new Response(null, { 
    status, 
    headers: { 
      ...corsHeadersFor(req), 
      ...(extra ?? {}) 
    } 
  });
}

function setCookie(cookie: string) {
  return { "Set-Cookie": cookie };
}

// Cookie string builder with flexible options
function makeCookie(name: string, value: string, opts: {maxAge?: number, sameSite?: "Lax"|"None"} = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure", // required on https
    `SameSite=${opts.sameSite ?? "Lax"}`,
  ];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

// Generate 12-character alphanumeric code (excluding confusing characters)
function generateStationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes 0, O, 1, I, L
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return emptyCors(req);
  }

  // Validate environment variables and log secret consistency
  if (!JWT_SECRET) {
    console.error("STATION_JWT_SECRET is not set");
    return jsonRes(req, 500, { error: "Server configuration error" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase environment variables");
    return jsonRes(req, 500, { error: "Server configuration error" });
  }

  // Log secret hash for consistency verification (safe to log; not the secret)
  const secretHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JWT_SECRET))))
    .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  console.log("JWT secret hash:", secretHash);

  const url = new URL(req.url);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Normalize pathname - remove function name prefix if present
  let pathname = url.pathname;
  if (pathname.startsWith("/station-login")) {
    pathname = pathname.replace("/station-login", "") || "/";
  }

  console.log(`${req.method} ${url.pathname} -> normalized: ${pathname}`);

  // POST /  -> login with code
  if (req.method === "POST" && pathname === "/") {
    try {
      const body = await req.json().catch(() => ({} as any));
      const { code, action } = body as { code?: string; action?: string };

      // Support logout via action in root as well (defensive)
      if (action === "logout") {
        const clearCookie = makeCookie(COOKIE_NAME, "", { maxAge: 0, sameSite: "Lax" });
        return jsonRes(req, 200, { ok: true }, { "Set-Cookie": clearCookie });
      }

      if (!code) return jsonRes(req, 400, { error: "Access code is required" });
      if (!/^[A-Z0-9]{12}$/.test(code)) return jsonRes(req, 400, { error: "Invalid code format" });

      console.log(`Attempting login with code: ${code}`);

      const { data, error } = await supabase
        .from("station_login_codes")
        .select("*")
        .eq("code", code)
        .single();

      if (error || !data) {
        console.log(`Code not found: ${code}`, error);
        return jsonRes(req, 401, { error: "Invalid access code" });
      }

      const now = new Date();

      if (!data.is_active) return jsonRes(req, 403, { error: "Access code has been deactivated" });
      if (data.expires_at && new Date(data.expires_at) < now) return jsonRes(req, 403, { error: "Access code has expired" });

      // Prepare JWT payload
      const payload = {
        cid: data.id,
        role: data.role,
        allowed_paths: data.allowed_paths,
        iat: getNumericDate(0),
        exp: getNumericDate(MAX_AGE),
      };

      // Import key and create JWT
      const key = await importHmacKey(JWT_SECRET);
      const header = { alg: "HS256", typ: "JWT" } as const;
      const jwt = await create(header, payload as Record<string, unknown>, key);

      // Only update last_used_at after successful JWT creation
      await supabase.from("station_login_codes").update({ last_used_at: now.toISOString() }).eq("id", data.id);

      // Determine redirect path - use default_page if available, otherwise first allowed path
      const redirectTo = data.default_page || 
        (Array.isArray(data.allowed_paths) && data.allowed_paths.length > 0 ? data.allowed_paths[0] : "/station");

      // Set cookie with proper SameSite attribute
      const sessionCookie = makeCookie(COOKIE_NAME, jwt, { maxAge: MAX_AGE, sameSite: "Lax" });
      
      console.log(`Successfully authenticated code: ${code}`);
      return jsonRes(req, 200, { ok: true, redirectTo, token: jwt }, { "Set-Cookie": sessionCookie });
    } catch (error) {
      console.error("Login error:", error);
      return jsonRes(req, 500, { error: "Internal server error" });
    }
  }

  // POST /station-logout -> clear cookie
  if (req.method === "POST" && pathname === "/station-logout") {
    const clearCookie = makeCookie(COOKIE_NAME, "", { maxAge: 0, sameSite: "Lax" });
    return jsonRes(req, 200, { ok: true }, { "Set-Cookie": clearCookie });
  }

  // POST /station-session -> validate cookie and return session info
  if ((req.method === "POST" || req.method === "GET") && pathname === "/station-session") {
    try {
      // Extract Bearer token (ignore empty/short ones)
      const authHeader = req.headers.get("authorization") || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
      const hasValidBearer = !!(bearerToken && bearerToken.length > 20);

      // Extract cookie - prefer station_session only
      function getCookie(req: Request, name: string) {
        const cookieHeader = req.headers.get("cookie") || "";
        const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
        return match ? decodeURIComponent(match[1]).replace(/^"(.*)"$/, '$1') : null;
      }
      
      const cookieToken = getCookie(req, COOKIE_NAME);

      // Import the key for verification
      const key = await importHmacKey(JWT_SECRET);

      // 1) Cookie first (prioritized)
      if (cookieToken) {
        try {
          const payload = (await verify(cookieToken, key, "HS256")) as any;
          return jsonRes(req, 200, { 
            ok: true, 
            via: "cookie", 
            role: payload.role, 
            allowed_paths: payload.allowed_paths, 
            default_page: payload.default_page 
          });
        } catch (cookieError) {
          console.log("Cookie token validation failed:", cookieError);
          // Clear invalid cookie but continue to try Bearer
        }
      }

      // 2) Then Bearer (if present & non-empty)
      if (hasValidBearer) {
        try {
          const payload = (await verify(bearerToken!, key, "HS256")) as any;
          return jsonRes(req, 200, { 
            ok: true, 
            via: "bearer", 
            role: payload.role, 
            allowed_paths: payload.allowed_paths, 
            default_page: payload.default_page 
          });
        } catch (bearerError) {
          console.log("Bearer token validation failed:", bearerError);
          return jsonRes(req, 401, { ok: false, reason: "invalid_token" });
        }
      }

      return jsonRes(req, 401, { ok: false, reason: "missing_token" });
    } catch (error) {
      console.error("Session validation error:", error);
      return jsonRes(req, 500, { ok: false, reason: 'server_error', detail: String(error) });
    }
  }

  // POST /generate-station-code -> admin-only (no auth check here; rely on admin UI)
  if (req.method === "POST" && pathname === "/generate-station-code") {
    try {
      const { 
        label, 
        role = "station", 
        expires_at, 
        allowed_paths = ["/station"], 
        default_page = "/station" 
      } = await req.json();

      // Ensure uniqueness with retries
      let code: string;
      let attempts = 0;
      const maxAttempts = 10;

      while (true) {
        attempts++;
        code = generateStationCode();
        const { data: existing } = await supabase
          .from("station_login_codes")
          .select("id")
          .eq("code", code)
          .maybeSingle();
        if (!existing) break;
        if (attempts > maxAttempts) return jsonRes(req, 500, { error: "Failed to generate unique code" });
      }

      const { data: newCode, error: createError } = await supabase
        .from("station_login_codes")
        .insert({ code, label, role, expires_at, allowed_paths, default_page })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create code:", createError);
        return jsonRes(req, 500, { error: "Failed to create access code" });
      }

      return jsonRes(req, 200, { ok: true, code: newCode });
    } catch (error) {
      console.error("Code generation error:", error);
      return jsonRes(req, 500, { error: "Internal server error" });
    }
  }

  return jsonRes(req, 404, { error: "Not found" });
});