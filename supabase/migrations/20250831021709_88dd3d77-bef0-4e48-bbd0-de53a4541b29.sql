-- Drop the old 2-parameter version of import_mark_stale to resolve ambiguity
DROP FUNCTION IF EXISTS public.import_mark_stale(integer, integer);