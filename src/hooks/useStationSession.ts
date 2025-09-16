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
        console.log('Checking station session...');
        
        const response = await fetch('/functions/v1/station-login/station-session', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
        });
        
        console.log('Session check response status:', response.status);
        
        const data = await response.json().catch(() => ({}));
        console.log('Session check response data:', data);
        
        if (!cancelled) {
          if (response.ok && data?.ok === true) {
            console.log('Session check successful, role:', data?.role);
            setSession(data || { ok: false });
          } else {
            console.log('Session check failed:', data?.reason || 'Unknown reason');
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
      setSession({ ok: false });
      window.location.href = '/station-login';
    } catch (error) {
      console.error('Logout failed:', error);
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