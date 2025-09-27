// Precision Barcode Generation Engine
// Generates SVG barcodes with integer-dot modules for reliable scanning

import { moduleMmFromDesired, quietZoneMmFromDesired, minimumBarcodeHeightMm, mmToDots } from './dotGrid';

export interface BarcodeOptions {
  symbology: string;
  module_width_mm: number;
  quiet_zone_mm: number;
  height_mm: number;
  width_mm: number;
}

export interface BarcodeResult {
  svg: string;
  actualModuleWidth: number;
  actualQuietZone: number;
  actualHeight: number;
  warnings: string[];
}

/**
 * Generate Code128 pattern (simplified for demo - use proper library in production)
 */
function generateCode128Pattern(data: string): number[] {
  // Simplified Code128 pattern generation
  // In production, use a proper barcode library like jsbarcode
  const pattern: number[] = [];
  
  // Start pattern for Code128
  pattern.push(2, 1, 1, 4, 1, 2); // Start Code B pattern
  
  // Data encoding (simplified)
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) - 32;
    // Simplified encoding - each character becomes a pattern
    const bars = [(charCode % 4) + 1, (charCode % 3) + 1, (charCode % 4) + 1, (charCode % 3) + 1];
    pattern.push(...bars);
  }
  
  // Stop pattern
  pattern.push(2, 3, 3, 1, 1, 1, 2); // Stop pattern
  
  return pattern;
}

/**
 * Generate precision SVG barcode with integer-dot modules
 */
export function generatePrecisionBarcode(
  data: string,
  options: BarcodeOptions
): BarcodeResult {
  const warnings: string[] = [];
  
  // Snap dimensions to dot grid
  const actualModuleWidth = moduleMmFromDesired(options.module_width_mm);
  const actualQuietZone = quietZoneMmFromDesired(options.quiet_zone_mm);
  const minHeight = minimumBarcodeHeightMm(options.symbology);
  const actualHeight = Math.max(minHeight, options.height_mm);
  
  // Add warnings for adjustments
  if (actualModuleWidth !== options.module_width_mm) {
    warnings.push(`Module width adjusted to ${actualModuleWidth.toFixed(3)}mm (${mmToDots(actualModuleWidth)} dots)`);
  }
  if (actualQuietZone !== options.quiet_zone_mm) {
    warnings.push(`Quiet zone adjusted to ${actualQuietZone.toFixed(3)}mm (${mmToDots(actualQuietZone)} dots)`);
  }
  if (actualHeight !== options.height_mm) {
    warnings.push(`Height increased to ${actualHeight.toFixed(3)}mm for reliable scanning`);
  }
  
  // Validate minimum requirements
  if (actualModuleWidth < 0.169) { // < 2 dots at 300 DPI
    warnings.push('⚠ Module width may be too small for reliable scanning');
  }
  if (actualQuietZone < 1.0) {
    warnings.push('⚠ Quiet zone may be too small for reliable scanning');
  }
  
  // Generate barcode pattern
  let pattern: number[];
  
  switch (options.symbology.toLowerCase()) {
    case 'code128':
      pattern = generateCode128Pattern(data);
      break;
    case 'ean13':
      // Simplified EAN-13 (would need proper implementation)
      pattern = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // Placeholder
      break;
    default:
      pattern = generateCode128Pattern(data);
  }
  
  // Calculate total width
  const patternWidth = pattern.reduce((sum, width) => sum + width, 0) * actualModuleWidth;
  const totalWidth = patternWidth + (2 * actualQuietZone);
  
  // Generate SVG bars
  let x = actualQuietZone;
  const bars: string[] = [];
  
  for (let i = 0; i < pattern.length; i++) {
    const barWidth = pattern[i] * actualModuleWidth;
    
    if (i % 2 === 0) { // Even indices are bars (black)
      bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${actualHeight}" fill="black"/>`);
    }
    
    x += barWidth;
  }
  
  // Generate SVG
  const svg = `<svg width="${totalWidth}mm" height="${actualHeight}mm" viewBox="0 0 ${totalWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
  <rect width="100%" height="100%" fill="white"/>
  ${bars.join('\n  ')}
  <text x="${totalWidth / 2}" y="${actualHeight + 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2mm" fill="black">${data}</text>
</svg>`;
  
  return {
    svg,
    actualModuleWidth,
    actualQuietZone,
    actualHeight,
    warnings
  };
}

/**
 * Validate barcode data for given symbology
 */
export function validateBarcodeData(data: string, symbology: string): string[] {
  const warnings: string[] = [];
  
  if (!data || data.trim() === '') {
    warnings.push('Barcode data is empty');
    return warnings;
  }
  
  switch (symbology.toLowerCase()) {
    case 'code128':
      // Code128 can encode most ASCII characters
      if (data.length > 48) {
        warnings.push('Code128 data may be too long for reliable scanning');
      }
      break;
      
    case 'ean13':
      if (!/^\d{12,13}$/.test(data)) {
        warnings.push('EAN-13 requires 12-13 digits');
      }
      break;
      
    case 'upca':
      if (!/^\d{11,12}$/.test(data)) {
        warnings.push('UPC-A requires 11-12 digits');
      }
      break;
  }
  
  return warnings;
}

/**
 * Get recommended dimensions for symbology
 */
export function getRecommendedDimensions(symbology: string): {
  module_width_mm: number;
  quiet_zone_mm: number;
  height_mm: number;
} {
  switch (symbology.toLowerCase()) {
    case 'code128':
      return {
        module_width_mm: 0.33, // ~4 dots at 300 DPI
        quiet_zone_mm: 2.54, // ~30 dots
        height_mm: 12.7 // ~150 dots
      };
      
    case 'ean13':
    case 'upca':
      return {
        module_width_mm: 0.33,
        quiet_zone_mm: 2.31, // 11 modules worth
        height_mm: 22.85 // Standard height
      };
      
    default:
      return {
        module_width_mm: 0.33,
        quiet_zone_mm: 2.54,
        height_mm: 12.7
      };
  }
}