-- Add last_progress_at column to product_import_runs for better watchdog timing
ALTER TABLE public.product_import_runs 
ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create index for last_progress_at for watchdog performance
CREATE INDEX IF NOT EXISTS pir_last_progress_idx 
ON public.product_import_runs (last_progress_at DESC);

-- Update the import_mark_stale function to handle both RUNNING and PENDING timeouts
CREATE OR REPLACE FUNCTION public.import_mark_stale(
  running_minutes INTEGER DEFAULT 15,
  pending_minutes INTEGER DEFAULT 5
) RETURNS TABLE(run_id UUID, old_status TEXT, new_status TEXT, error_msg TEXT) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Create trigger to update last_progress_at automatically
CREATE OR REPLACE FUNCTION public.update_import_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_progress_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS update_import_progress_trigger ON public.product_import_runs;
CREATE TRIGGER update_import_progress_trigger
  BEFORE UPDATE ON public.product_import_runs
  FOR EACH ROW
  WHEN (OLD.processed_count IS DISTINCT FROM NEW.processed_count OR 
        OLD.created_count IS DISTINCT FROM NEW.created_count OR 
        OLD.updated_count IS DISTINCT FROM NEW.updated_count OR 
        OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.update_import_progress_timestamp();