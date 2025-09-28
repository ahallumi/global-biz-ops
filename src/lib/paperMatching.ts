// Paper matching utilities for Brother QL-800 + PrintNode integration
export type Papers = Record<string, [number | null, number | null]>; // tenths of mm

export interface PaperMatch {
  name: string;
  rotate: number;
}

export interface PrinterCapabilities {
  papers?: Papers;
  dpis?: string[];
  supports_custom_paper_size?: boolean;
}

// Convert millimeters to tenths of millimeters (PrintNode format)
export function mmToTenths(mm: number): number {
  return Math.round(mm * 10);
}

// Convert tenths of millimeters back to millimeters
export function tenthsToMm(tenths: number): number {
  return tenths / 10;
}

// Find matching paper name in printer capabilities
export function findPaperMatch(
  papers: Papers,
  widthMm: number,
  heightMm: number,
  tolerance: number = 10 // ±1.0mm in tenths (widened from ±0.5mm)
): PaperMatch | null {
  const targetW = mmToTenths(widthMm);
  const targetH = mmToTenths(heightMm);
  
  const isMatch = (paperW: number | null, paperH: number | null, targetW: number, targetH: number): boolean => {
    return paperW !== null && paperH !== null && 
           Math.abs(paperW - targetW) <= tolerance && 
           Math.abs(paperH - targetH) <= tolerance;
  };

  for (const [paperName, [paperW, paperH]] of Object.entries(papers)) {
    // Check normal orientation
    if (isMatch(paperW, paperH, targetW, targetH)) {
      return { name: paperName, rotate: 0 };
    }
    // Check rotated orientation (90 degrees)
    if (isMatch(paperW, paperH, targetH, targetW)) {
      return { name: paperName, rotate: 90 };
    }
  }

  return null;
}

// Brother QL series common DK roll presets
export const BROTHER_DK_PRESETS = [
  { name: 'DK-1201', width_mm: 29, height_mm: 90, description: 'Standard Address Labels' },
  { name: 'DK-1202', width_mm: 62, height_mm: 100, description: 'Shipping/Name Badge Labels' },
  { name: 'DK-1209', width_mm: 28.9, height_mm: 62, description: 'Small Address Labels (28.9×62mm)' },
  { name: 'DK-11209', width_mm: 29, height_mm: 62, description: 'Small Address Labels' },
  { name: 'DK-11208', width_mm: 38, height_mm: 90, description: 'Large Address Labels' },
  { name: 'DK-1219', width_mm: 12, height_mm: 0, description: '12mm Continuous Tape' },
  { name: 'DK-1221', width_mm: 23, height_mm: 0, description: '23mm Continuous Tape' },
  { name: 'DK-1241', width_mm: 102, height_mm: 152, description: 'Large Shipping Labels' },
] as const;

// Validate if a profile matches Brother DK specifications
export function validateBrotherProfile(widthMm: number, heightMm: number): {
  isValid: boolean;
  matchedPreset?: typeof BROTHER_DK_PRESETS[number];
  warning?: string;
} {
  const preset = BROTHER_DK_PRESETS.find(
    p => Math.abs(p.width_mm - widthMm) <= 0.5 && 
         (p.height_mm === 0 || Math.abs(p.height_mm - heightMm) <= 0.5)
  );

  if (preset) {
    return { isValid: true, matchedPreset: preset };
  }

  return {
    isValid: false,
    warning: `${widthMm}×${heightMm}mm doesn't match standard Brother DK rolls. Consider using a preset size.`
  };
}

// Generate print options for PrintNode
export function generatePrintOptions(
  capabilities: PrinterCapabilities | undefined,
  widthMm: number,
  heightMm: number,
  dpi: number = 300
): {
  options: any;
  warnings: string[];
} {
  const warnings: string[] = [];
  const options: any = {
    fit_to_page: false,
    dpi: `${dpi}x${dpi}`
  };

  if (!capabilities?.papers) {
    warnings.push('Printer capabilities not available. Using default settings.');
    return { options, warnings };
  }

  const paperMatch = findPaperMatch(capabilities.papers, widthMm, heightMm);
  
  if (paperMatch) {
    options.paper = paperMatch.name;
    options.rotate = paperMatch.rotate;
    
    if (paperMatch.rotate !== 0) {
      warnings.push(`Label will be rotated ${paperMatch.rotate}° to match printer paper orientation.`);
    }
  } else {
    warnings.push(
      `No matching paper size found. Ensure printer is configured for ${widthMm}×${heightMm}mm labels in Printing Preferences.`
    );
    
    if (!capabilities.supports_custom_paper_size) {
      warnings.push('Printer does not support custom paper sizes. Use a standard Brother DK roll size.');
    }
  }

  return { options, warnings };
}