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
        const { data, error } = await supabase.functions.invoke('station-login');
        
        if (!cancelled) {
          if (error) {
            console.error('Station session check failed:', error);
            setSession({ ok: false });
          } else {
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
      await supabase.functions.invoke('station-login', {
        method: 'POST',
        body: { action: 'logout' }
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