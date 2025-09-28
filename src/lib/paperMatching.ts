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

// Find Brother DK paper name preference for given dimensions
export function findBrotherPaperName(
  papers: Papers,
  widthMm: number,
  heightMm: number
): string | null {
  // First, check if dimensions match a Brother DK preset
  const dkPreset = BROTHER_DK_PRESETS.find(
    p => Math.abs(p.width_mm - widthMm) <= 0.5 && 
         (p.height_mm === 0 || Math.abs(p.height_mm - heightMm) <= 0.5)
  );

  if (dkPreset) {
    // Look for Brother-preferred paper names in the printer's available papers
    for (const preferredName of dkPreset.paper_names) {
      if (papers[preferredName]) {
        return preferredName;
      }
    }
  }

  return null;
}

// Find matching paper name in printer capabilities with Brother preference
export function findPaperMatch(
  papers: Papers,
  widthMm: number,
  heightMm: number,
  tolerance: number = 5 // ±0.5mm in tenths
): PaperMatch | null {
  const targetW = mmToTenths(widthMm);
  const targetH = mmToTenths(heightMm);
  
  const isMatch = (paperW: number | null, paperH: number | null, targetW: number, targetH: number): boolean => {
    return paperW !== null && paperH !== null && 
           Math.abs(paperW - targetW) <= tolerance && 
           Math.abs(paperH - targetH) <= tolerance;
  };

  // First priority: Try Brother DK preferred paper names
  const brotherPaperName = findBrotherPaperName(papers, widthMm, heightMm);
  if (brotherPaperName) {
    const [paperW, paperH] = papers[brotherPaperName];
    if (isMatch(paperW, paperH, targetW, targetH)) {
      return { name: brotherPaperName, rotate: 0 };
    }
    if (isMatch(paperW, paperH, targetH, targetW)) {
      return { name: brotherPaperName, rotate: 90 };
    }
  }

  // Second priority: Standard dimensional matching
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

// Brother QL series common DK roll presets with paper name mappings
export const BROTHER_DK_PRESETS = [
  { 
    name: 'DK-1201', width_mm: 29, height_mm: 90, 
    description: 'Standard Address Labels',
    paper_names: ['29 x 90 mm', 'DK-1201', '1.1" x 3.5"', '2.9cm x 9cm']
  },
  { 
    name: 'DK-1202', width_mm: 62, height_mm: 100, 
    description: 'Shipping/Name Badge Labels',
    paper_names: ['62 x 100 mm', 'DK-1202', '2.4" x 3.9"', '6.2cm x 10cm']
  },
  { 
    name: 'DK-1209', width_mm: 28.9, height_mm: 62, 
    description: 'Small Address Labels',
    paper_names: ['29 x 62 mm', 'DK-1209', '1.1" x 2.4"', '2.9cm x 6.2cm']
  },
  { 
    name: 'DK-11209', width_mm: 29, height_mm: 62, 
    description: 'Small Address Labels',
    paper_names: ['29 x 62 mm', 'DK-11209', '1.1" x 2.4"', '2.9cm x 6.2cm']
  },
  { 
    name: 'DK-11208', width_mm: 38, height_mm: 90, 
    description: 'Large Address Labels',
    paper_names: ['38 x 90 mm', 'DK-11208', '1.5" x 3.5"', '3.8cm x 9cm']
  },
  { 
    name: 'DK-1219', width_mm: 12, height_mm: 0, 
    description: '12mm Continuous Tape',
    paper_names: ['12mm Continuous', 'DK-1219', '0.47" Continuous']
  },
  { 
    name: 'DK-1221', width_mm: 23, height_mm: 0, 
    description: '23mm Continuous Tape',
    paper_names: ['23mm Continuous', 'DK-1221', '0.9" Continuous']
  },
  { 
    name: 'DK-1241', width_mm: 102, height_mm: 152, 
    description: 'Large Shipping Labels',
    paper_names: ['102 x 152 mm', 'DK-1241', '4" x 6"', '10.2cm x 15.2cm']
  },
] as const;

// Validate if a profile matches Brother DK specifications
export function validateBrotherProfile(widthMm: number, heightMm: number): {
  isValid: boolean;
  matchedPreset?: typeof BROTHER_DK_PRESETS[number];
  warning?: string;
  isContinuous?: boolean;
} {
  // Check for exact preset match
  const preset = BROTHER_DK_PRESETS.find(
    p => Math.abs(p.width_mm - widthMm) <= 0.5 && 
         (p.height_mm === 0 || Math.abs(p.height_mm - heightMm) <= 0.5)
  );

  if (preset) {
    return { 
      isValid: true, 
      matchedPreset: preset,
      isContinuous: preset.height_mm === 0 
    };
  }

  // Check for continuous roll compatibility (width-only match)
  const continuousPreset = BROTHER_DK_PRESETS.find(
    p => p.height_mm === 0 && Math.abs(p.width_mm - widthMm) <= 1.0
  );

  if (continuousPreset) {
    return {
      isValid: true,
      matchedPreset: continuousPreset,
      isContinuous: true,
      warning: `Using ${continuousPreset.name} (${continuousPreset.width_mm}mm) for ${widthMm}×${heightMm}mm labels`
    };
  }

  // Check for close die-cut matches (allow for common variations)
  const closePreset = BROTHER_DK_PRESETS.find(
    p => p.height_mm > 0 && 
         Math.abs(p.width_mm - widthMm) <= 1.0 && 
         Math.abs(p.height_mm - heightMm) <= 1.0
  );

  if (closePreset) {
    return {
      isValid: true,
      matchedPreset: closePreset,
      isContinuous: false,
      warning: `Close match: ${closePreset.name} (${closePreset.width_mm}×${closePreset.height_mm}mm) for ${widthMm}×${heightMm}mm labels`
    };
  }

  return {
    isValid: false,
    warning: `${widthMm}×${heightMm}mm doesn't match standard Brother DK rolls. Ensure correct media is loaded.`
  };
}

// Generate calibration grid HTML for testing
export function generateCalibrationGrid(widthMm: number, heightMm: number): string {
  const gridSizeMm = 10; // 10mm grid squares
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { 
          size: ${widthMm}mm ${heightMm}mm; 
          margin: 0; 
        }
        html, body { 
          width: ${widthMm}mm; 
          height: ${heightMm}mm; 
          margin: 0; 
          padding: 0; 
          font-family: Arial, sans-serif;
          font-size: 6px;
          color: black;
        }
        .grid-container {
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(to right, black 1px, transparent 1px),
            linear-gradient(to bottom, black 1px, transparent 1px);
          background-size: ${gridSizeMm}mm ${gridSizeMm}mm;
          position: relative;
        }
        .dimensions {
          position: absolute;
          top: 2px;
          left: 2px;
          background: white;
          padding: 1px 2px;
        }
        .center-mark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 4px;
          height: 4px;
          background: red;
          border-radius: 50%;
        }
      </style>
    </head>
    <body>
      <div class="grid-container">
        <div class="dimensions">${widthMm}×${heightMm}mm</div>
        <div class="center-mark"></div>
      </div>
    </body>
    </html>
  `;
}

// Generate basic print options for PrintNode - simplified for reliability
export function generatePrintOptions(
  capabilities: PrinterCapabilities | undefined,
  widthMm: number,
  heightMm: number,
  dpi: number = 300,
  printerModel?: string
): {
  options: any;
  warnings: string[];
  brotherInfo?: {
    detectedRoll?: string;
    setupRequired?: boolean;
    setupInstructions?: string[];
  };
} {
  const warnings: string[] = [];
  const options: any = {
    fit_to_page: false,
    dpi: `${dpi}x${dpi}`
  };

  // Try to find matching paper if capabilities are available
  if (capabilities?.papers) {
    const paperMatch = findPaperMatch(capabilities.papers, widthMm, heightMm);
    if (paperMatch) {
      options.paper = paperMatch.name;
      if (paperMatch.rotate !== 0) {
        options.rotate = paperMatch.rotate;
      }
      console.log(`Using paper: ${paperMatch.name} (rotate: ${paperMatch.rotate || 0}°)`);
    }
  }

  return { options, warnings };
}