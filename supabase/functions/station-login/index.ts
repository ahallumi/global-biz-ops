import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const JWT_SECRET = Deno.env.get("STATION_JWT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const COOKIE_NAME = "station_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

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

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

function setCookie(cookie: string) {
  return { "Set-Cookie": cookie };
}

function cookieStr(name: string, val: string, maxAge = MAX_AGE) {
  const parts = [
    `${name}=${val}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
    `Secure`,
  ];
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
    return new Response(null, { headers: corsHeaders });
  }

  // Validate environment variables
  if (!JWT_SECRET) {
    console.error("STATION_JWT_SECRET is not set");
    return json({ error: "Server configuration error" }, 500);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase environment variables");
    return json({ error: "Server configuration error" }, 500);
  }

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
        const headers = setCookie(cookieStr(COOKIE_NAME, "", 0));
        return json({ ok: true }, 200, headers);
      }

      if (!code) return json({ error: "Access code is required" }, 400);
      if (!/^[A-Z0-9]{12}$/.test(code)) return json({ error: "Invalid code format" }, 400);

      console.log(`Attempting login with code: ${code}`);

      const { data, error } = await supabase
        .from("station_login_codes")
        .select("*")
        .eq("code", code)
        .single();

      if (error || !data) {
        console.log(`Code not found: ${code}`, error);
        return json({ error: "Invalid access code" }, 401);
      }

      const now = new Date();

      if (!data.is_active) return json({ error: "Access code has been deactivated" }, 403);
      if (data.expires_at && new Date(data.expires_at) < now) return json({ error: "Access code has expired" }, 403);

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

      // Determine redirect path from allowed_paths
      const redirectTo = Array.isArray(data.allowed_paths) && data.allowed_paths.length > 0 
        ? data.allowed_paths[0] 
        : "/station";

      const headers = setCookie(cookieStr(COOKIE_NAME, jwt));
      console.log(`Successfully authenticated code: ${code}`);
      return json({ ok: true, redirectTo }, 200, headers);
    } catch (error) {
      console.error("Login error:", error);
      return json({ error: "Internal server error" }, 500);
    }
  }

  // POST /station-logout -> clear cookie
  if (req.method === "POST" && pathname === "/station-logout") {
    const headers = setCookie(cookieStr(COOKIE_NAME, "", 0));
    return json({ ok: true }, 200, headers);
  }

  // POST /station-session -> validate cookie and return session info
  if ((req.method === "POST" || req.method === "GET") && pathname === "/station-session") {
    try {
      const cookie = req.headers.get("cookie") || "";
      const token = cookie.split("; ").find((c) => c.startsWith(`${COOKIE_NAME}=`))?.split("=")[1];
      if (!token) return json({ ok: false });

      const payload = (await verify(token, JWT_SECRET, "HS256")) as any;
      return json({ ok: true, role: payload.role, allowed_paths: payload.allowed_paths });
    } catch (error) {
      console.log("Session validation failed:", error);
      return json({ ok: false });
    }
  }

  // POST /generate-station-code -> admin-only (no auth check here; rely on admin UI)
  if (req.method === "POST" && pathname === "/generate-station-code") {
    try {
      const { label, role = "station", expires_at, allowed_paths = ["/station"] } = await req.json();

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
        if (attempts > maxAttempts) return json({ error: "Failed to generate unique code" }, 500);
      }

      const { data: newCode, error: createError } = await supabase
        .from("station_login_codes")
        .insert({ code, label, role, expires_at, allowed_paths })
        .select()
        .single();

      if (createError) {
        console.error("Failed to create code:", createError);
        return json({ error: "Failed to create access code" }, 500);
      }

      return json({ ok: true, code: newCode });
    } catch (error) {
      console.error("Code generation error:", error);
      return json({ error: "Internal server error" }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
});