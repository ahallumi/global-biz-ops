import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StationSession {
  ok: boolean;
  role?: string;
  allowed_paths?: string[];
}

export function useStationSession() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<StationSession>({ ok: false });

  useEffect(() => {
    let cancelled = false;
    
    const fetchSession = async (withBearer = true) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (withBearer) {
        const token = sessionStorage.getItem('station_jwt');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await fetch('/functions/v1/station-login/station-session', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok && data?.ok === true, response, data };
    };
    
    const checkSession = async () => {
      try {
        // First try with Bearer token if available
        let { ok, data } = await fetchSession(true);
        
        if (!ok && (data?.reason === 'invalid_token' || data?.reason === 'missing_token')) {
          // Auto-recovery: clear stale Bearer token and retry with cookie only
          const hasBearer = !!sessionStorage.getItem('station_jwt');
          if (hasBearer) {
            console.log('Bearer token issue, clearing and retrying with cookie...');
            sessionStorage.removeItem('station_jwt');
            ({ ok, data } = await fetchSession(false));
          }
        }
        
        if (!cancelled) {
          if (ok) {
            console.log('Session check successful:', data);
            setSession(data || { ok: false });
          } else {
            console.error('Station session check failed:', data);
            setSession({ ok: false });
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Station session check error:', error);
        if (!cancelled) {
          setSession({ ok: false });
          setLoading(false);
        }
      }
    };

    checkSession();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      await fetch('/functions/v1/station-login/station-logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      // Clear session storage token
      sessionStorage.removeItem('station_jwt');
      setSession({ ok: false });
      window.location.href = '/station-login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear session storage even if logout call fails
      sessionStorage.removeItem('station_jwt');
      // Force redirect even if logout call fails
      window.location.href = '/station-login';
    }
  };

  return { 
    loading, 
    authenticated: session.ok, 
    role: session.role, 
    allowedPaths: session.allowed_paths,
    logout 
  };
}