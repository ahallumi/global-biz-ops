-- Fix the import_mark_stale function to resolve column ambiguity
CREATE OR REPLACE FUNCTION public.import_mark_stale(running_minutes integer DEFAULT 15, pending_minutes integer DEFAULT 5, partial_minutes integer DEFAULT 30)
 RETURNS TABLE(run_id uuid, prev_status text, curr_status text, err_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    RETURNING id,
              'RUNNING'::text AS prev_status,
              'FAILED'::text AS curr_status,
              'No progress for ' || running_minutes || ' minutes' AS err_message
  )
  SELECT stale_running.id, stale_running.prev_status, stale_running.curr_status, stale_running.err_message FROM stale_running;

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
    RETURNING id,
              'PENDING'::text AS prev_status,
              'FAILED'::text AS curr_status,
              'Stuck in PENDING for ' || pending_minutes || ' minutes' AS err_message
  )
  SELECT stale_pending.id, stale_pending.prev_status, stale_pending.curr_status, stale_pending.err_message FROM stale_pending;

  -- Mark stale PARTIAL imports (no progress for partial_minutes)
  RETURN QUERY
  WITH stale_partial AS (
    UPDATE public.product_import_runs 
    SET status = 'FAILED', 
        finished_at = now(),
        errors = COALESCE(errors, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'timestamp', now(),
            'code', 'STALE_PARTIAL', 
            'message', 'Watchdog: PARTIAL too old for ' || partial_minutes || ' minutes'
          )
        )
    WHERE status = 'PARTIAL'
      AND last_progress_at < (now() - make_interval(mins => partial_minutes))
    RETURNING id,
              'PARTIAL'::text AS prev_status,
              'FAILED'::text AS curr_status,
              'PARTIAL too old for ' || partial_minutes || ' minutes' AS err_message
  )
  SELECT stale_partial.id, stale_partial.prev_status, stale_partial.curr_status, stale_partial.err_message FROM stale_partial;
END;
$function$