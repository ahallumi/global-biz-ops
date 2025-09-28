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
  // Snap dimensions to common Brother media sizes
  if (Math.abs(width_mm - 29) < 2 && Math.abs(height_mm - 90) < 5) {
    return 'DK-1201'; // 29x90mm die-cut labels
  }
  if (Math.abs(width_mm - 62) < 2 && Math.abs(height_mm - 100) < 5) {
    return 'DK-1202'; // 62x100mm die-cut labels  
  }
  if (Math.abs(width_mm - 29) < 2 && Math.abs(height_mm - 90) < 5) {
    return 'DK-1209'; // 29x90mm address labels
  }
  
  // Default to DK-1201 for unknown sizes
  return 'DK-1201';
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
  
  // Check for non-standard dimensions
  if (mediaType === 'DK-1201' && (Math.abs(width_mm - 29) > 1 || Math.abs(height_mm - 90) > 3)) {
    warnings.push(`Label dimensions ${width_mm}×${height_mm}mm don't match DK-1201 roll (29×90mm). Please verify media is loaded correctly.`);
  }
  
  if (mediaType === 'DK-1202' && (Math.abs(width_mm - 62) > 1 || Math.abs(height_mm - 100) > 3)) {
    warnings.push(`Label dimensions ${width_mm}×${height_mm}mm don't match DK-1202 roll (62×100mm). Please verify media is loaded correctly.`);
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