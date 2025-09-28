// Brother printer detection and RAW mode utilities

interface Printer {
  id: string;
  name: string;
  make_and_model: string;
  default: boolean;
  status: string;
  capabilities?: {
    papers?: Record<string, [number | null, number | null]>;
    dpis?: string[];
    supports_custom_paper_size?: boolean;
  };
}

// Brother QL series models that support RAW raster printing
const BROTHER_QL_MODELS = [
  'QL-800',
  'QL-810W', 
  'QL-820NWB',
  'QL-1100',
  'QL-1110NWB',
  'QL-1060N'
];

// Media type detection based on label dimensions
export function detectMediaType(width_mm: number, height_mm: number): string {
  // Check for exact die-cut matches first (both dimensions must match)
  if (Math.abs(width_mm - 29) < 2 && Math.abs(height_mm - 90) < 5) {
    return 'DK-1201'; // 29x90mm die-cut labels
  }
  if (Math.abs(width_mm - 62) < 2 && Math.abs(height_mm - 100) < 5) {
    return 'DK-1202'; // 62x100mm die-cut labels  
  }
  if (Math.abs(width_mm - 29) < 2 && Math.abs(height_mm - 90) < 5) {
    return 'DK-1209'; // 29x90mm address labels (same as DK-1201)
  }
  
  // For continuous rolls, only width matters (height can be custom)
  if (Math.abs(width_mm - 62) < 2) {
    return 'DK-22205'; // 62mm continuous white paper roll
  }
  if (Math.abs(width_mm - 29) < 2) {
    return 'DK-22210'; // 29mm continuous white paper roll
  }
  
  // Default based on width - use continuous roll for custom sizes
  if (width_mm >= 45) {
    return 'DK-22205'; // 62mm continuous
  }
  return 'DK-22210'; // 29mm continuous
}

// Check if printer is a Brother QL series
export function isBrotherQLPrinter(printer: Printer): boolean {
  const model = printer.make_and_model?.toUpperCase() || printer.name?.toUpperCase() || '';
  
  return BROTHER_QL_MODELS.some(qlModel => 
    model.includes(qlModel) || model.includes(qlModel.replace('-', ''))
  );
}

// Determine optimal print mode for printer
export function getOptimalPrintMode(printer: Printer): 'raw_raster' | 'pdf' {
  return isBrotherQLPrinter(printer) ? 'raw_raster' : 'pdf';
}

// Get Brother-specific warnings and recommendations
export function getBrotherPrintWarnings(
  printer: Printer, 
  width_mm: number, 
  height_mm: number
): string[] {
  const warnings: string[] = [];
  
  if (!isBrotherQLPrinter(printer)) {
    return warnings;
  }
  
  const mediaType = detectMediaType(width_mm, height_mm);
  
  // Only warn for die-cut labels if dimensions don't match exactly
  if (mediaType === 'DK-1201' && (Math.abs(width_mm - 29) > 1 || Math.abs(height_mm - 90) > 3)) {
    warnings.push(`Label dimensions ${width_mm}×${height_mm}mm don't match DK-1201 die-cut labels (29×90mm). Please verify correct media is loaded.`);
  }
  
  if (mediaType === 'DK-1202' && (Math.abs(width_mm - 62) > 1 || Math.abs(height_mm - 100) > 3)) {
    warnings.push(`Label dimensions ${width_mm}×${height_mm}mm don't match DK-1202 die-cut labels (62×100mm). Please verify correct media is loaded.`);
  }
  
  // For continuous rolls, only warn if width is significantly off
  if (mediaType === 'DK-22205' && Math.abs(width_mm - 62) > 2) {
    warnings.push(`Label width ${width_mm}mm doesn't match 62mm continuous roll. Expected width: 62mm.`);
  }
  
  if (mediaType === 'DK-22210' && Math.abs(width_mm - 29) > 2) {
    warnings.push(`Label width ${width_mm}mm doesn't match 29mm continuous roll. Expected width: 29mm.`);
  }
  
  return warnings;
}

// Validate Brother printer capabilities
export function validateBrotherPrinting(
  printer: Printer,
  width_mm: number,
  height_mm: number
): { valid: boolean; warnings: string[]; mediaType: string } {
  const warnings = getBrotherPrintWarnings(printer, width_mm, height_mm);
  const mediaType = detectMediaType(width_mm, height_mm);
  
  return {
    valid: isBrotherQLPrinter(printer),
    warnings,
    mediaType
  };
}