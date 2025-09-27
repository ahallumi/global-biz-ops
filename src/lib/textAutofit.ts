// Text auto-fit utility with binary search algorithm
export interface OverflowSettings {
  mode: 'shrink_to_fit' | 'wrap_lines' | 'ellipsis';
  min_font_size_pt: number;
  max_lines?: number;
}

export interface TextMeasurement {
  width: number;
  height: number;
  fits: boolean;
}

// Create a temporary DOM element for text measurement
function createMeasurementElement(
  text: string,
  fontSizePt: number,
  fontFamily: string,
  fontWeight: number,
  lineHeight: number = 1.2
): HTMLElement {
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.top = '-9999px';
  element.style.visibility = 'hidden';
  element.style.whiteSpace = 'pre-wrap';
  element.style.wordWrap = 'break-word';
  element.style.fontSize = `${fontSizePt}pt`;
  element.style.fontFamily = fontFamily;
  element.style.fontWeight = String(fontWeight);
  element.style.lineHeight = String(lineHeight);
  element.style.margin = '0';
  element.style.padding = '0';
  element.textContent = text;
  
  document.body.appendChild(element);
  return element;
}

// Measure text dimensions at given font size
export function measureText(
  text: string,
  fontSizePt: number,
  fontFamily: string,
  fontWeight: number,
  boxWidthPx: number,
  boxHeightPx: number,
  maxLines?: number
): TextMeasurement {
  const element = createMeasurementElement(text, fontSizePt, fontFamily, fontWeight);
  element.style.width = `${boxWidthPx}px`;
  
  const rect = element.getBoundingClientRect();
  const lineHeight = fontSizePt * 1.2; // Convert pt to px (approximate)
  const actualLines = Math.ceil(rect.height / lineHeight);
  
  const fits = rect.width <= boxWidthPx && 
               rect.height <= boxHeightPx && 
               (!maxLines || actualLines <= maxLines);
  
  document.body.removeChild(element);
  
  return {
    width: rect.width,
    height: rect.height,
    fits
  };
}

// Binary search to find optimal font size
export async function fitTextToBox(
  text: string,
  boxPx: { width: number; height: number },
  style: { 
    font_family: string; 
    font_weight: number; 
    font_size_pt: number;
  },
  overflow: OverflowSettings
): Promise<{ fontSize: number; warning?: string }> {
  if (!text || boxPx.width <= 0 || boxPx.height <= 0) {
    return { fontSize: overflow.min_font_size_pt };
  }

  let low = overflow.min_font_size_pt;
  let high = style.font_size_pt;
  let bestFit = low;
  
  // Binary search for optimal font size (max 8 iterations)
  for (let i = 0; i < 8; i++) {
    const mid = (low + high) / 2;
    const measurement = measureText(
      text,
      mid,
      style.font_family,
      style.font_weight,
      boxPx.width,
      boxPx.height,
      overflow.max_lines
    );
    
    if (measurement.fits) {
      bestFit = mid;
      low = mid;
    } else {
      high = mid;
    }
    
    // Break early if we're close enough
    if (Math.abs(high - low) < 0.1) break;
  }
  
  const warning = bestFit <= overflow.min_font_size_pt ? 
    'Text too large for box - minimum font size reached' : undefined;
  
  return { fontSize: bestFit, warning };
}

// Helper to convert mm to pixels for measurement
export function mmToPx(mm: number, dpi: number = 300): number {
  return (mm / 25.4) * dpi;
}

// Helper for unit suffix formatting
export function getUnitSuffix(unit?: string): string {
  if (!unit) return '';
  const u = unit.toLowerCase();
  if (u === 'lb') return '/lb';
  if (u === 'kg') return '/kg';
  if (u === 'ea' || u === 'unit' || u === 'each') return '/ea';
  return `/${u}`;
}