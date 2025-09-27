// Dot Grid Utilities for 300 DPI Precision Label Printing
// Ensures all dimensions snap to printer dots to avoid sub-pixel rendering issues

const DPI = 300;
const MM_PER_IN = 25.4;
const PT_PER_IN = 72;

// Fundamental conversion constants
export const DOT_MM = MM_PER_IN / DPI; // ≈ 0.084666... mm per dot
export const mmToPx = (mm: number, dpi: number = 300): number => (mm / 25.4) * dpi;
export const pxToMm = (px: number, dpi: number = 300): number => (px * 25.4) / dpi;
export const ptFromMm = (mm: number): number => (mm / MM_PER_IN) * PT_PER_IN;
export const mmFromPt = (pt: number): number => (pt / PT_PER_IN) * MM_PER_IN;

/**
 * Snap a millimeter value to nearest N printer dots
 * @param mm - Value in millimeters
 * @param dots - Number of dots to snap to (default: 1)
 * @returns Snapped value in millimeters
 */
export function snapMm(mm: number, dots: number = 1): number {
  const dotsFloat = mm / DOT_MM;
  const snappedDots = Math.round(dotsFloat / dots) * dots;
  return snappedDots * DOT_MM;
}

/**
 * Snap a size dimension ensuring it's at least 1 dot when rounded
 * @param mm - Size value in millimeters
 * @returns Snapped size value in millimeters (minimum 1 dot)
 */
export function snapSizeMm(mm: number): number {
  const dots = Math.max(1, Math.round(mm / DOT_MM));
  return dots * DOT_MM;
}

/**
 * Convert a font size to pixel-perfect dots for the given DPI
 * @param pt - Font size in points
 * @param dpi - Dots per inch (default: 300)
 * @returns Snapped font size in points
 */
export function snapFontSizePt(pt: number, dpi: number = 300): number {
  const ptPerDot = PT_PER_IN / dpi; // 0.24 pt per dot at 300 DPI
  return Math.round(pt / ptPerDot) * ptPerDot;
}

/**
 * Calculate barcode module width in dots, ensuring minimum scannable width
 * @param desiredMm - Desired module width in millimeters
 * @returns Module width in millimeters (minimum 2 dots ≈ 0.169mm)
 */
export function moduleMmFromDesired(desiredMm: number): number {
  const dots = Math.max(2, Math.round(desiredMm / DOT_MM));
  return dots * DOT_MM;
}

/**
 * Calculate minimum quiet zone for barcodes (≥12 dots ≈ 1.02mm)
 * @param desiredMm - Desired quiet zone in millimeters
 * @returns Quiet zone in millimeters (minimum 12 dots)
 */
export function quietZoneMmFromDesired(desiredMm: number): number {
  const dots = Math.max(12, Math.round(desiredMm / DOT_MM));
  return dots * DOT_MM;
}

/**
 * Calculate minimum barcode height for reliable scanning
 * @param symbology - Barcode type
 * @returns Minimum height in millimeters
 */
export function minimumBarcodeHeightMm(symbology: string = 'code128'): number {
  switch (symbology.toLowerCase()) {
    case 'code128':
      return Math.max(140, Math.round(11.9 / DOT_MM)) * DOT_MM; // ≥140 dots ≈ 11.9mm
    case 'ean13':
    case 'upca':
      return Math.max(190, Math.round(16.1 / DOT_MM)) * DOT_MM; // ≥190 dots ≈ 16.1mm
    default:
      return Math.max(140, Math.round(11.9 / DOT_MM)) * DOT_MM;
  }
}

/**
 * Convert mm to dots for display purposes
 * @param mm - Value in millimeters
 * @returns Number of dots (rounded)
 */
export function mmToDots(mm: number): number {
  return Math.round(mm / DOT_MM);
}

/**
 * Convert dots to mm
 * @param dots - Number of dots
 * @returns Value in millimeters
 */
export function dotsToMm(dots: number): number {
  return dots * DOT_MM;
}

/**
 * Snap element dimensions to dot grid
 * @param element - Element with mm dimensions
 * @returns Element with snapped dimensions
 */
export function snapElement<T extends { x_mm: number; y_mm: number; w_mm: number; h_mm: number }>(
  element: T
): T {
  return {
    ...element,
    x_mm: snapMm(element.x_mm),
    y_mm: snapMm(element.y_mm),
    w_mm: snapSizeMm(element.w_mm),
    h_mm: snapSizeMm(element.h_mm),
  };
}

/**
 * Apply station calibration to element (scale + offset)
 * @param element - Element to calibrate
 * @param calibration - Scale and offset factors
 * @returns Calibrated element
 */
export interface StationCalibration {
  scale_x: number;
  scale_y: number;
  offset_x_mm: number;
  offset_y_mm: number;
}

export function applyCalibration<T extends { x_mm: number; y_mm: number; w_mm: number; h_mm: number }>(
  element: T,
  calibration: StationCalibration
): T {
  const x = (element.x_mm * calibration.scale_x) + calibration.offset_x_mm;
  const y = (element.y_mm * calibration.scale_y) + calibration.offset_y_mm;
  const w = element.w_mm * calibration.scale_x;
  const h = element.h_mm * calibration.scale_y;
  
  return {
    ...element,
    x_mm: x,
    y_mm: y,
    w_mm: w,
    h_mm: h,
  };
}