-- Remove NOT NULL constraint from layout column to allow HTML templates
ALTER TABLE public.label_templates ALTER COLUMN layout DROP NOT NULL;

-- Add check constraint to ensure data integrity for both template types
ALTER TABLE public.label_templates ADD CONSTRAINT label_templates_content_check 
CHECK (
  (template_type = 'visual' AND layout IS NOT NULL AND html_template IS NULL) OR
  (template_type = 'html' AND html_template IS NOT NULL AND layout IS NULL)
);