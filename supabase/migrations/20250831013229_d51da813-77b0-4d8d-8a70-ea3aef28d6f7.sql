-- Fix security warnings by adding search path to functions
CREATE OR REPLACE FUNCTION public.import_mark_stale(
  running_minutes INTEGER DEFAULT 15,
  pending_minutes INTEGER DEFAULT 5
) RETURNS TABLE(run_id UUID, old_status TEXT, new_status TEXT, error_msg TEXT) 
LANGUAGE plpgsql SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  -- Mark stale RUNNING imports (no progress for running_minutes)
  RETURN QUERY
  WITH stale_running AS (
    UPDATE public.product_import_runs 
    SET status = 'FAILED', 
        finished_at = now(),
        errors = COALESCE(errors, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'timestamp', now(),
            'code', 'STALE_RUNNING',
            'message', 'Watchdog: No progress for ' || running_minutes || ' minutes'
          )
        )
    WHERE status = 'RUNNING' 
      AND last_progress_at < (now() - make_interval(mins => running_minutes))
    RETURNING id, 'RUNNING'::text as old_status, 'FAILED'::text as new_status, 
              'No progress for ' || running_minutes || ' minutes' as error_msg
  )
  SELECT sr.id, sr.old_status, sr.new_status, sr.error_msg FROM stale_running sr;

  -- Mark stale PENDING imports (stuck for pending_minutes)
  RETURN QUERY
  WITH stale_pending AS (
    UPDATE public.product_import_runs 
    SET status = 'FAILED', 
        finished_at = now(),
        errors = COALESCE(errors, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'timestamp', now(),
            'code', 'STALE_PENDING', 
            'message', 'Watchdog: Stuck in PENDING for ' || pending_minutes || ' minutes'
          )
        )
    WHERE status = 'PENDING' 
      AND started_at < (now() - make_interval(mins => pending_minutes))
    RETURNING id, 'PENDING'::text as old_status, 'FAILED'::text as new_status,
              'Stuck in PENDING for ' || pending_minutes || ' minutes' as error_msg
  )
  SELECT sp.id, sp.old_status, sp.new_status, sp.error_msg FROM stale_pending sp;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_import_progress_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.last_progress_at = now();
  RETURN NEW;
END;
$$;