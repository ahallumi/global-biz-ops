// Shared Layout Engine for Designer and Server-side Rendering
// Provides consistent font sizing, text measurement, and overflow handling

import { snapMm, snapSizeMm, snapFontSizePt, DOT_MM, ptFromMm, mmFromPt } from './dotGrid';

export interface OverflowSettings {
  mode: 'shrink_to_fit' | 'wrap_lines' | 'ellipsis';
  min_font_size_pt: number;
  max_lines?: number;
}

export interface TextStyle {
  font_family: string;
  font_size_pt: number;
  font_weight: number;
  line_height?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

export interface TextMeasurement {
  width: number;
  height: number;
  fits: boolean;
  actualLines: number;
}

export interface LayoutBox {
  width: number;
  height: number;
}

export interface FitResult {
  fontSize: number;
  warning?: string;
  actualLines?: number;
}

/**
 * Create a measurement element for accurate text sizing
 * @param isServer - Whether running server-side (affects DOM methods)
 * @returns Measurement element or null if server-side
 */
function createMeasurementElement(isServer: boolean = false): HTMLElement | null {
  if (isServer || typeof document === 'undefined') {
    return null;
  }
  
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.top = '-9999px';
  element.style.visibility = 'hidden';
  element.style.whiteSpace = 'pre-wrap';
  element.style.wordWrap = 'break-word';
  element.style.margin = '0';
  element.style.padding = '0';
  element.style.border = 'none';
  document.body.appendChild(element);
  return element;
}

/**
 * Measure text dimensions with given styling
 * @param text - Text to measure
 * @param style - Font styling
 * @param boxPx - Container dimensions in pixels
 * @param isServer - Server-side rendering flag
 * @returns Text measurement
 */
export function measureText(
  text: string,
  style: TextStyle,
  boxPx: LayoutBox,
  isServer: boolean = false
): TextMeasurement {
  if (isServer || typeof document === 'undefined') {
    // Server-side approximation based on character count and font size
    const avgCharWidthPx = (style.font_size_pt * 0.6 * 96) / 72; // Rough approximation
    const lineHeightPx = style.font_size_pt * (style.line_height || 1.2) * 96 / 72;
    
    const approxWidth = text.length * avgCharWidthPx;
    const approxLines = Math.ceil(approxWidth / boxPx.width);
    const approxHeight = approxLines * lineHeightPx;
    
    return {
      width: Math.min(approxWidth, boxPx.width),
      height: approxHeight,
      fits: approxHeight <= boxPx.height && approxWidth <= boxPx.width,
      actualLines: approxLines
    };
  }

  const element = createMeasurementElement();
  if (!element) {
    throw new Error('Cannot create measurement element');
  }

  try {
    // Apply styling with snapped font size
    const snappedFontSize = snapFontSizePt(style.font_size_pt);
    element.style.fontFamily = `${style.font_family}, sans-serif`;
    element.style.fontSize = `${snappedFontSize}pt`;
    element.style.fontWeight = String(style.font_weight);
    element.style.lineHeight = String(style.line_height || 1.2);
    element.style.width = `${boxPx.width}px`;
    element.style.height = 'auto';
    element.style.overflow = 'visible';
    element.textContent = text;

    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const actualLines = Math.round(rect.height / lineHeight);

    return {
      width: rect.width,
      height: rect.height,
      fits: rect.width <= boxPx.width && rect.height <= boxPx.height,
      actualLines
    };
  } finally {
    document.body.removeChild(element);
  }
}

/**
 * Binary search for optimal font size with dot-grid constraints
 * @param text - Text to fit
 * @param boxPx - Container in pixels
 * @param style - Base font styling
 * @param overflow - Overflow settings
 * @param isServer - Server-side rendering flag
 * @returns Optimal font size and metadata
 */
export async function fitTextToBox(
  text: string,
  boxPx: LayoutBox,
  style: TextStyle,
  overflow: OverflowSettings,
  isServer: boolean = false
): Promise<FitResult> {
  if (!text || text.trim() === '') {
    return { fontSize: style.font_size_pt };
  }

  const maxFontSize = style.font_size_pt;
  const minFontSize = overflow.min_font_size_pt || 6;
  const maxLines = overflow.max_lines || 2;
  
  // For non-shrink modes, return original size
  if (overflow.mode !== 'shrink_to_fit') {
    const measurement = measureText(text, style, boxPx, isServer);
    return { 
      fontSize: style.font_size_pt,
      actualLines: measurement.actualLines,
      warning: !measurement.fits ? 'Text may overflow container' : undefined
    };
  }

  let low = minFontSize;
  let high = maxFontSize;
  let bestFit = minFontSize;
  let iterations = 0;
  const maxIterations = 20;

  while (low <= high && iterations < maxIterations) {
    const mid = (low + high) / 2;
    const snappedMid = snapFontSizePt(mid);
    
    const testStyle = { ...style, font_size_pt: snappedMid };
    const measurement = measureText(text, testStyle, boxPx, isServer);

    if (measurement.fits && measurement.actualLines <= maxLines) {
      bestFit = snappedMid;
      low = snappedMid + 0.1;
    } else {
      high = snappedMid - 0.1;
    }
    
    iterations++;
  }

  const finalMeasurement = measureText(
    text, 
    { ...style, font_size_pt: bestFit }, 
    boxPx, 
    isServer
  );

  return {
    fontSize: bestFit,
    actualLines: finalMeasurement.actualLines,
    warning: bestFit <= minFontSize ? `Font size reduced to minimum (${minFontSize}pt)` : undefined
  };
}

/**
 * Calculate line height that snaps to dot grid
 * @param fontSizePt - Font size in points
 * @param lineHeightRatio - Line height multiplier (default: 1.2)
 * @param dpi - Target DPI (default: 300)
 * @returns Snapped line height ratio
 */
export function snapLineHeight(fontSizePt: number, lineHeightRatio: number = 1.2, dpi: number = 300): number {
  const fontSizeMm = mmFromPt(fontSizePt);
  const desiredLineHeightMm = fontSizeMm * lineHeightRatio;
  const snappedLineHeightMm = snapMm(desiredLineHeightMm);
  return snappedLineHeightMm / fontSizeMm;
}

/**
 * Generate CSS with dot-grid aligned dimensions
 * @param style - Text styling
 * @param dpi - Target DPI
 * @returns CSS properties object
 */
export function generatePrecisionCSS(style: TextStyle, dpi: number = 300): Record<string, string> {
  const snappedFontSize = snapFontSizePt(style.font_size_pt, dpi);
  const snappedLineHeight = snapLineHeight(snappedFontSize, style.line_height || 1.2, dpi);
  
  return {
    'font-family': `${style.font_family}, sans-serif`,
    'font-size': `${snappedFontSize}pt`,
    'font-weight': String(style.font_weight),
    'line-height': String(snappedLineHeight),
    'text-align': style.align || 'left',
    'color': style.color || '#000000',
    'font-kerning': 'normal',
    'letter-spacing': '0',
    '-webkit-print-color-adjust': 'exact',
    'print-color-adjust': 'exact'
  };
}

/**
 * Validate element dimensions against printable constraints
 * @param element - Element with dimensions
 * @param canvasSize - Canvas dimensions in mm
 * @returns Validation warnings
 */
export function validateElementConstraints(
  element: { x_mm: number; y_mm: number; w_mm: number; h_mm: number; type?: string },
  canvasSize: { width_mm: number; height_mm: number }
): string[] {
  const warnings: string[] = [];
  
  // Check bounds
  if (element.x_mm < 0 || element.y_mm < 0) {
    warnings.push('Element extends outside canvas (negative position)');
  }
  
  if (element.x_mm + element.w_mm > canvasSize.width_mm ||
      element.y_mm + element.h_mm > canvasSize.height_mm) {
    warnings.push('Element extends outside canvas bounds');
  }
  
  // Check minimum sizes (in dots)
  const minDots = element.type === 'barcode' ? 5 : 2;
  const minMm = minDots * DOT_MM;
  
  if (element.w_mm < minMm || element.h_mm < minMm) {
    warnings.push(`Element too small (minimum: ${minMm.toFixed(2)}mm)`);
  }
  
  return warnings;
}