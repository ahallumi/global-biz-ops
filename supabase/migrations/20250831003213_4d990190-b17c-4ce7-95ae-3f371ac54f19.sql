-- Enhanced Square Import Schema Migration
-- Add last_progress_at column for better watchdog tracking
ALTER TABLE public.product_import_runs 
ADD COLUMN IF NOT EXISTS last_progress_at timestamp with time zone DEFAULT now();

-- Update existing rows to have last_progress_at set
UPDATE public.product_import_runs 
SET last_progress_at = COALESCE(finished_at, started_at) 
WHERE last_progress_at IS NULL;

-- Add constraint to ensure last_progress_at is not null
ALTER TABLE public.product_import_runs 
ALTER COLUMN last_progress_at SET NOT NULL;

-- Add index for watchdog performance
CREATE INDEX IF NOT EXISTS idx_product_import_runs_progress 
ON public.product_import_runs(status, last_progress_at);

-- Helper function to mark stale runs (both RUNNING and PENDING)
CREATE OR REPLACE FUNCTION public.import_mark_stale(
  running_minutes int DEFAULT 15,
  pending_minutes int DEFAULT 5
) 
RETURNS TABLE(run_id uuid, old_status text, new_status text, error_msg text) 
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

-- Add last_error column to inventory_integrations for quick UI access
ALTER TABLE public.inventory_integrations 
ADD COLUMN IF NOT EXISTS last_error text;

-- Create trigger to update last_progress_at on any update to import runs
CREATE OR REPLACE FUNCTION public.update_import_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_progress_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_import_progress ON public.product_import_runs;
CREATE TRIGGER trigger_update_import_progress
  BEFORE UPDATE ON public.product_import_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_import_progress_timestamp();