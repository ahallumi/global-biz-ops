-- Add calibration columns to label_print_overrides for per-station precision tuning
ALTER TABLE label_print_overrides
  ADD COLUMN scale_x numeric DEFAULT 1.0 CHECK (scale_x >= 0.98 AND scale_x <= 1.02),
  ADD COLUMN scale_y numeric DEFAULT 1.0 CHECK (scale_y >= 0.98 AND scale_y <= 1.02),
  ADD COLUMN offset_x_mm numeric DEFAULT 0 CHECK (offset_x_mm >= -2.0 AND offset_x_mm <= 2.0),
  ADD COLUMN offset_y_mm numeric DEFAULT 0 CHECK (offset_y_mm >= -2.0 AND offset_y_mm <= 2.0);

-- Add comment explaining the calibration columns
COMMENT ON COLUMN label_print_overrides.scale_x IS 'Horizontal scale factor for mechanical drift compensation (0.98-1.02)';
COMMENT ON COLUMN label_print_overrides.scale_y IS 'Vertical scale factor for mechanical drift compensation (0.98-1.02)';
COMMENT ON COLUMN label_print_overrides.offset_x_mm IS 'Horizontal offset in mm for position correction (-2.0 to 2.0)';
COMMENT ON COLUMN label_print_overrides.offset_y_mm IS 'Vertical offset in mm for position correction (-2.0 to 2.0)';