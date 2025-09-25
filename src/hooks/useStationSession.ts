import { useEffect, useState } from "react";

type SessionState = {
  ok: boolean;
  role?: string;
  allowed_paths?: string[];
  default_page?: string;
  via?: "bearer" | "cookie";
  reason?: string;
};

const STORAGE_KEY = "station_jwt";

export function useStationSession() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionState>({ ok: false });

  const fetchSession = async (withBearer: boolean) => {
    const headers: Record<string, string> = {};
    if (withBearer) {
      const t = sessionStorage.getItem(STORAGE_KEY);
      if (t) headers["Authorization"] = `Bearer ${t}`;
    }
    const res = await fetch('https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/station-session', {
      method: "GET",
      credentials: "include",   // still allow cookie path if it works
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.ok === true, data };
  };

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        console.log('Checking station session...');
        
        // 1) Try with Bearer if we have one
        let { ok, data } = await fetchSession(true);
        console.log('Bearer attempt:', ok, data?.via);

        // 2) If Bearer is bad/missing, clear it and retry cookie-only
        if (!ok && (data?.reason === "invalid_token" || data?.reason === "missing_token")) {
          if (sessionStorage.getItem(STORAGE_KEY)) {
            console.log('Clearing invalid Bearer token, retrying with cookie...');
            sessionStorage.removeItem(STORAGE_KEY);
          }
          ({ ok, data } = await fetchSession(false));
          console.log('Cookie attempt:', ok, data?.via);
        }

        if (!cancelled) {
        if (ok) {
          // Normalize allowed_paths - trim whitespace and ensure consistent format
          const normalizedData = {
            ...data,
            allowed_paths: data?.allowed_paths?.map((path: string) => path.trim().toLowerCase()) || []
          };
          console.log('Session check successful via:', data?.via, 'role:', data?.role, 'allowed_paths:', normalizedData.allowed_paths);
          setSession(normalizedData);
          } else {
            console.log('Session check failed:', data?.reason || 'Unknown reason');
            setSession({ ok: false, reason: data?.reason });
          }
          setLoading(false);
        }
      } catch (e) {
        console.error('Station session check error:', e);
        if (!cancelled) {
          setSession({ ok: false });
          setLoading(false);
        }
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPermissions = async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add Bearer token if available
      const token = sessionStorage.getItem(STORAGE_KEY);
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch('https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/refresh', {
        method: 'POST',
        credentials: 'include',
        headers,
      });

      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.success && data.token) {
        // Store new token and update session
        sessionStorage.setItem(STORAGE_KEY, data.token);
        await refetchSession();
        return { success: true };
      } else {
        console.log('Refresh failed:', data.error || 'Unknown error');
        return { success: false, error: data.error || 'refresh_failed' };
      }
    } catch (error) {
      console.error('Refresh permissions error:', error);
      return { success: false, error: 'network_error' };
    }
  };

  const logout = async () => {
    // Clear Bearer first so the next check doesn't get poisoned
    sessionStorage.removeItem(STORAGE_KEY);
    try {
      await fetch('https://ffxvnhrqxkirdogknoid.supabase.co/functions/v1/station-login/station-logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setSession({ ok: false });
    window.location.assign('/station-login');
  };

  const refetchSession = async () => {
    setLoading(true);
    try {
      console.log('Refreshing station session...');
      
      // Try with Bearer if we have one
      let { ok, data } = await fetchSession(true);
      
      // If Bearer is bad/missing, clear it and retry cookie-only
      if (!ok && (data?.reason === "invalid_token" || data?.reason === "missing_token")) {
        if (sessionStorage.getItem(STORAGE_KEY)) {
          sessionStorage.removeItem(STORAGE_KEY);
        }
        ({ ok, data } = await fetchSession(false));
      }

      if (ok) {
        // Normalize allowed_paths - trim whitespace and ensure consistent format
        const normalizedData = {
          ...data,
          allowed_paths: data?.allowed_paths?.map((path: string) => path.trim().toLowerCase()) || []
        };
        console.log('Session refresh successful via:', data?.via, 'role:', data?.role, 'allowed_paths:', normalizedData.allowed_paths);
        setSession(normalizedData);
      } else {
        console.log('Session refresh failed:', data?.reason || 'Unknown reason');
        setSession({ ok: false, reason: data?.reason });
      }
    } catch (e) {
      console.error('Station session refresh error:', e);
      setSession({ ok: false });
    } finally {
      setLoading(false);
    }
  };

  return { 
    loading, 
    authenticated: session.ok, 
    role: session.role, 
    allowedPaths: session.allowed_paths,
    defaultPage: session.default_page,
    logout,
    refetchSession,
    refreshPermissions
  };
}