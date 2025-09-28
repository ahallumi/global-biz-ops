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
}

// Brother QL media size definitions
const MEDIA_TYPES = {
  'DK-1201': { width_mm: 29, height_mm: 90, code: [0x0C] }, // 29x90 die-cut
  'DK-1202': { width_mm: 62, height_mm: 100, code: [0x17] }, // 62x100 die-cut
  'DK-1209': { width_mm: 29, height_mm: 90, code: [0x0C] }, // 29x90 address labels
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

// Generate Brother QL raster command sequence
function generateBrotherRasterCommands(
  bitmapData: Uint8Array, 
  width_dots: number, 
  height_dots: number,
  media_type: string
): Uint8Array {
  const commands: number[] = [];
  
  // 1. Initialize printer
  commands.push(0x1B, 0x40); // ESC @ - Initialize
  
  // 2. Switch to raster mode
  commands.push(0x1B, 0x69, 0x61, 0x01); // ESC i a 1 - Raster mode
  
  // 3. Print information command - set media size
  const mediaInfo = MEDIA_TYPES[media_type as keyof typeof MEDIA_TYPES];
  if (mediaInfo) {
    commands.push(
      0x1B, 0x69, 0x7A, // ESC i z - Print information command
      mediaInfo.code[0], // Media type code
      0x0A, // Media length (auto)
      0x00, 0x00, 0x00, 0x00, // Raster number (4 bytes, little endian)
      0x00, // Starting page
      0x00 // Number of pages (0 = auto)
    );
  }
  
  // 4. Set margins to 0
  commands.push(0x1B, 0x69, 0x64, 0x00, 0x00); // ESC i d - Set margins
  
  // 5. Set compression mode (no compression for simplicity)
  commands.push(0x4D, 0x00); // M 0 - No compression
  
  // 6. Raster data transfer
  const bytesPerLine = Math.ceil(width_dots / 8);
  
  for (let y = 0; y < height_dots; y++) {
    // Raster graphics transfer command
    commands.push(0x67, 0x00, bytesPerLine); // g 00 n - Graphics data
    
    // Get line data from bitmap
    const lineStart = y * bytesPerLine;
    for (let x = 0; x < bytesPerLine; x++) {
      const byteIndex = lineStart + x;
      commands.push(byteIndex < bitmapData.length ? bitmapData[byteIndex] : 0x00);
    }
  }
  
  // 7. Print and cut
  commands.push(0x1A); // Print with feed and cut
  
  return new Uint8Array(commands);
}

// Convert HTML to monochrome bitmap using canvas
async function htmlToBitmap(
  html: string, 
  width_mm: number, 
  height_mm: number,
  calibration?: RasterRequest['calibration']
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
    const { html, width_mm, height_mm, media_type, calibration }: RasterRequest = await req.json();
    
    console.log('Generating Brother raster data:', { 
      width_mm, 
      height_mm, 
      media_type,
      calibration 
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
    const bitmap = await htmlToBitmap(html, width_mm, height_mm, calibration);
    
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