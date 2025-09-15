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
        const response = await fetch('/functions/v1/station-login/station-session', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!cancelled) {
          if (!response.ok) {
            console.error('Station session check failed:', response.status);
            setSession({ ok: false });
          } else {
            const data = await response.json().catch(() => ({ ok: false }));
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