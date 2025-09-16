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
    
    const checkSession = async () => {
      try {
        // Include Authorization header if token exists in sessionStorage
        const token = sessionStorage.getItem('station_jwt');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/functions/v1/station-login/station-session', {
          method: 'POST',
          credentials: 'include',
          headers,
        });
        
        if (!cancelled) {
          if (!response.ok) {
            console.error('Station session check failed:', response.status);
            setSession({ ok: false });
          } else {
            const data = await response.json().catch(() => ({ ok: false }));
            console.log('Session check response:', data);
            setSession(data || { ok: false });
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