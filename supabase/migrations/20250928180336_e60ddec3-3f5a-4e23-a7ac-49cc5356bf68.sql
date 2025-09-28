-- Add HTML template support to label_templates table

-- Add template_type enum to distinguish between visual (JSON) and html templates
DO $$ BEGIN
  CREATE TYPE template_type AS ENUM ('visual', 'html');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to label_templates table
ALTER TABLE label_templates 
ADD COLUMN IF NOT EXISTS template_type template_type DEFAULT 'visual',
ADD COLUMN IF NOT EXISTS html_template TEXT;

-- Update existing templates to be marked as 'visual' type
UPDATE label_templates 
SET template_type = 'visual' 
WHERE template_type IS NULL;

-- Make template_type NOT NULL after setting defaults
ALTER TABLE label_templates 
ALTER COLUMN template_type SET NOT NULL;

-- Add check constraint to ensure either layout (for visual) or html_template (for html) is provided
ALTER TABLE label_templates 
ADD CONSTRAINT check_template_content 
CHECK (
  (template_type = 'visual' AND layout IS NOT NULL) OR
  (template_type = 'html' AND html_template IS NOT NULL)
);

-- Add index for faster queries by template_type
CREATE INDEX IF NOT EXISTS idx_label_templates_type ON label_templates(template_type);

-- Add comments for documentation
COMMENT ON COLUMN label_templates.template_type IS 'Type of template: visual (JSON-based designer) or html (raw HTML)';
COMMENT ON COLUMN label_templates.html_template IS 'Raw HTML template with variable substitutions (only for html template_type)';