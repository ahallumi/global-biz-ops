import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ServerTime {
  utc: string;
  chicago_time: string;
  formatted: string;
  time_only: string;
  timezone: string;
}

export function useServerTime(intervalMs: number = 30000) {
  const [serverTime, setServerTime] = useState<ServerTime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServerTime = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('time-now');
      
      if (error) throw error;
      
      setServerTime(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch server time:', err);
      setError('Failed to get server time');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately
    fetchServerTime();
    
    // Set up interval to fetch regularly
    const interval = setInterval(fetchServerTime, intervalMs);
    
    return () => clearInterval(interval);
  }, [intervalMs]);

  return { serverTime, loading, error, refetch: fetchServerTime };
}