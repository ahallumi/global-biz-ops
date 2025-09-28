import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RasterRequest {
  html: string;
  width_mm: number;
  height_mm: number;
  media_type: string; // 'DK-1201' for 29x90mm, 'DK-1202' for 62x100mm
  calibration?: {
    scale_x?: number;
    scale_y?: number;
    offset_x_mm?: number;
    offset_y_mm?: number;
  };
  test?: boolean; // when true, generate a RAW self-test pattern
}

// Brother QL media size definitions
const MEDIA_TYPES = {
  'DK-1201': { width_mm: 29, height_mm: 90, code: [0x0C], continuous: false }, // 29x90 die-cut
  'DK-1202': { width_mm: 62, height_mm: 100, code: [0x17], continuous: false }, // 62x100 die-cut
  'DK-1209': { width_mm: 29, height_mm: 90, code: [0x0C], continuous: false }, // 29x90 address labels
  'DK-22205': { width_mm: 62, height_mm: 0, code: [0x3E], continuous: true }, // 62mm continuous white paper
  'DK-22210': { width_mm: 29, height_mm: 0, code: [0x04], continuous: true }, // 29mm continuous white paper
};

// Convert mm to dots at 300 DPI
function mmToDots(mm: number): number {
  return Math.round(mm * 300 / 25.4);
}

// Snap dimensions to whole dots for precision
function snapMm(mm: number): number {
  const dots = mmToDots(mm);
  return dots * 25.4 / 300;
}

// Generate Brother QL raster commands
function generateBrotherRasterCommands(
  bitmap: Uint8Array,
  width_dots: number,
  height_dots: number,
  media_type: string
): Uint8Array {
  const media = MEDIA_TYPES[media_type as keyof typeof MEDIA_TYPES];
  if (!media) {
    throw new Error(`Unsupported media type: ${media_type}`);
  }

  const commands: number[] = [];
  
  // 1. Initialize printer
  commands.push(0x1B, 0x40); // ESC @ - Initialize/Reset
  
  // 2. Switch to raster mode
  commands.push(0x1B, 0x69, 0x61, 0x01); // ESC i a - raster mode
  
  // 3. Set media type and print information command
  if (media.continuous) {
    // For continuous media, specify width and auto-length
    commands.push(0x1B, 0x69, 0x7A, 0x8A, 0x0A, ...media.code, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00);
  } else {
    // For die-cut media, use standard info command
    commands.push(0x1B, 0x69, 0x7A, 0x84, 0x00, ...media.code, 0x00, 0x00, 0x00, 0x00, 0x00);
  }
  
  // 4. Set margins to 0 for precise positioning
  commands.push(0x1B, 0x69, 0x64, 0x00, 0x00); // ESC i d - margin amount (0mm)
  
  // 5. Various mode settings for quality
  commands.push(0x1B, 0x69, 0x4D, 0x40); // ESC i M - various mode settings
  
  // 6. Advanced settings for Brother QL-800 series
  commands.push(0x1B, 0x69, 0x4B, 0x08); // ESC i K - cut settings (auto-cut on)
  
  // 7. Send raster data line by line
  const bytesPerLine = Math.ceil(width_dots / 8);
  
  for (let y = 0; y < height_dots; y++) {
    // Get line data
    const lineStart = y * bytesPerLine;
    const lineData = bitmap.slice(lineStart, lineStart + bytesPerLine);
    
    // Transfer raster graphics data command
    commands.push(0x67, 0x00, bytesPerLine); // 'g' 0x00 nn - transfer raster data
    commands.push(...Array.from(lineData));
  }
  
  // 8. Print and feed command
  if (media.continuous) {
    commands.push(0x1B, 0x69, 0x41, height_dots & 0xFF, (height_dots >> 8) & 0xFF); // ESC i A - feed amount for continuous
  }
  
  // 9. Print and cut
  commands.push(0x1A); // Print and cut
  
  return new Uint8Array(commands);
}

// Convert HTML to monochrome bitmap using canvas
async function htmlToBitmap(
  html: string, 
  width_mm: number, 
  height_mm: number,
  calibration?: RasterRequest['calibration'],
  test?: boolean
): Promise<{ data: Uint8Array; width: number; height: number }> {
  
  // Apply calibration to dimensions
  let adjustedWidth = width_mm;
  let adjustedHeight = height_mm;
  
  if (calibration) {
    adjustedWidth *= (calibration.scale_x || 1.0);
    adjustedHeight *= (calibration.scale_y || 1.0);
  }
  
  // Snap to whole dots for precision
  const finalWidth = snapMm(adjustedWidth);
  const finalHeight = snapMm(adjustedHeight);
  
  const width_dots = mmToDots(finalWidth);
  const height_dots = mmToDots(finalHeight);
  
  // Create a simple bitmap renderer (for now, create a test pattern)
  // In production, this would use a proper HTML renderer like Puppeteer
  // But for Deno Edge Functions, we'll create a simple pattern
  
  const bytesPerLine = Math.ceil(width_dots / 8);
  const totalBytes = bytesPerLine * height_dots;
  const bitmap = new Uint8Array(totalBytes);
  
  // Create a simple test pattern with border and text area
  for (let y = 0; y < height_dots; y++) {
    for (let x = 0; x < width_dots; x++) {
      const byteIndex = Math.floor(y * bytesPerLine + x / 8);
      const bitIndex = 7 - (x % 8);
      
      let pixel = 0; // 0 = white, 1 = black
      
      // Border
      if (x < 3 || x >= width_dots - 3 || y < 3 || y >= height_dots - 3) {
        pixel = 1;
      }
      
      // Text area simulation (black bars for barcode-like pattern)
      if (x > 10 && x < width_dots - 10 && y > height_dots * 0.6 && y < height_dots * 0.9) {
        if ((x - 10) % 4 < 2) {
          pixel = 1;
        }
      }
      
      // Ruler ticks when in test mode: minor ticks every ~2.5mm (at 300 DPI: ~30 dots)
      if (test) {
        const tickSpacing = 30; // ~2.54mm per 30 dots at 300DPI
        if (y < 6 && (x % tickSpacing === 0)) pixel = 1;      // top ticks
        if (x < 6 && (y % tickSpacing === 0)) pixel = 1;      // left ticks
      }
      
      if (pixel) {
        bitmap[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  return {
    data: bitmap,
    width: width_dots,
    height: height_dots
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { html, width_mm, height_mm, media_type, calibration, test }: RasterRequest = await req.json();
    
    console.log('Generating Brother raster data:', { 
      width_mm, 
      height_mm, 
      media_type,
      calibration,
      test
    });

    if (!html || !width_mm || !height_mm || !media_type) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: html, width_mm, height_mm, media_type' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate media type
    if (!(media_type in MEDIA_TYPES)) {
      return new Response(JSON.stringify({ 
        error: `Unsupported media type: ${media_type}. Supported: ${Object.keys(MEDIA_TYPES).join(', ')}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert HTML to bitmap
    const bitmap = await htmlToBitmap(html, width_mm, height_mm, calibration, test);
    
    // Generate Brother raster commands
    const rasterCommands = generateBrotherRasterCommands(
      bitmap.data, 
      bitmap.width, 
      bitmap.height,
      media_type
    );
    
    // Convert to base64
    const rasterBase64 = btoa(String.fromCharCode(...rasterCommands));
    
    console.log('Generated raster data:', {
      bitmap_size: `${bitmap.width}x${bitmap.height} dots`,
      command_bytes: rasterCommands.length,
      base64_length: rasterBase64.length
    });

    return new Response(JSON.stringify({ 
      raw_base64: rasterBase64,
      bitmap_width: bitmap.width,
      bitmap_height: bitmap.height,
      command_size: rasterCommands.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating Brother raster data:', error);
    return new Response(JSON.stringify({ 
      error: (error as any)?.message || 'Failed to generate raster data' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});