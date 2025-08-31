-- One-time cleanup: force-fail any old PENDING/RUNNING runs to clear the queue
UPDATE public.product_import_runs
SET status = 'FAILED', 
    finished_at = now(),
    errors = COALESCE(errors, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'timestamp', now(),
        'code', 'FORCE_CLEANUP',
        'message', 'Force-cleaned by admin during system update'
      )
    )
WHERE status IN ('PENDING', 'RUNNING');