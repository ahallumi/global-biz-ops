import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LabelData {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  size: string | null;
  unit: string;
}

interface LabelOptions {
  width_mm: number;
  height_mm: number;
  dpi: number;
  margin_mm: number;
}

interface GenerateLabelRequest {
  template_id: string;
  data: LabelData;
  options: LabelOptions;
}

function generateBarcodeSVG(code: string, width: number = 200, height: number = 50): string {
  if (!code || code.trim() === '') {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="12">No barcode</text>
    </svg>`;
  }

  // Simple barcode generation (Code 128 style pattern)
  const bars = code.split('').map((char) => {
    const charCode = char.charCodeAt(0);
    return (charCode % 4) + 1; // Simple pattern generation
  });

  const barWidth = width / (bars.length * 3);
  let x = 0;
  let barsHTML = '';

  for (const barHeight of bars) {
    barsHTML += `<rect x="${x}" y="0" width="${barWidth}" height="${height * 0.8}" fill="black"/>`;
    x += barWidth * 3;
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    ${barsHTML}
    <text x="50%" y="${height * 0.95}" text-anchor="middle" font-family="Arial, sans-serif" font-size="8">${code}</text>
  </svg>`;
}

function generateLabelHTML(templateId: string, data: LabelData, options: LabelOptions): string {
  const { width_mm, height_mm, margin_mm } = options;
  const barcodeCode = data.barcode || data.sku || data.id.slice(-8);
  const price = data.price ? `$${data.price.toFixed(2)}` : 'Price N/A';
  const barcodeSVG = generateBarcodeSVG(barcodeCode, 150, 30);

  if (templateId === 'brother-29x90-product') {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { 
          size: ${width_mm}mm ${height_mm}mm; 
          margin: ${margin_mm}mm; 
        }
        html, body { 
          width: ${width_mm}mm; 
          height: ${height_mm}mm; 
          margin: 0; 
          padding: 2mm;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        }
        .label {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .product-name {
          font-size: 8px;
          font-weight: bold;
          line-height: 1.1;
          text-align: center;
          margin-bottom: 2mm;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        .price {
          font-size: 10px;
          font-weight: bold;
          text-align: right;
          margin-bottom: 1mm;
        }
        .barcode {
          text-align: center;
          margin: 1mm 0;
        }
        .sku {
          font-size: 6px;
          text-align: center;
          color: #666;
        }
        .timestamp {
          font-size: 5px;
          position: absolute;
          bottom: 1mm;
          right: 1mm;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="product-name">${data.name}</div>
        <div class="price">${price}</div>
        <div class="barcode">${barcodeSVG}</div>
        <div class="sku">${data.sku || 'SKU: N/A'}</div>
        <div class="timestamp">${new Date().toLocaleDateString()}</div>
      </div>
    </body>
    </html>`;
  }

  if (templateId === 'brother-62x100-shelf') {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { 
          size: ${width_mm}mm ${height_mm}mm; 
          margin: ${margin_mm}mm; 
        }
        html, body { 
          width: ${width_mm}mm; 
          height: ${height_mm}mm; 
          margin: 0; 
          padding: 3mm;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        }
        .label {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .product-name {
          font-size: 12px;
          font-weight: bold;
          line-height: 1.2;
          text-align: center;
          margin-bottom: 3mm;
        }
        .price {
          font-size: 16px;
          font-weight: bold;
          text-align: center;
          margin-bottom: 2mm;
        }
        .barcode {
          text-align: center;
          margin: 2mm 0;
        }
        .details {
          text-align: center;
          font-size: 8px;
          color: #666;
        }
        .timestamp {
          font-size: 6px;
          position: absolute;
          bottom: 1mm;
          right: 1mm;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="product-name">${data.name}</div>
        <div class="price">${price}</div>
        <div class="barcode">${barcodeSVG}</div>
        <div class="details">
          ${data.size ? `Size: ${data.size} | ` : ''}Unit: ${data.unit}
          ${data.sku ? `<br>SKU: ${data.sku}` : ''}
        </div>
        <div class="timestamp">${new Date().toLocaleDateString()}</div>
      </div>
    </body>
    </html>`;
  }

  // Default template
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @page { 
        size: ${width_mm}mm ${height_mm}mm; 
        margin: ${margin_mm}mm; 
      }
      html, body { 
        width: ${width_mm}mm; 
        height: ${height_mm}mm; 
        margin: 0; 
        padding: 2mm;
        font-family: Arial, sans-serif;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div style="text-align: center; padding: 10mm;">
      <h3>${data.name}</h3>
      <p>${price}</p>
      <div>${barcodeSVG}</div>
    </div>
  </body>
  </html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_id, data, options }: GenerateLabelRequest = await req.json();

    console.log('Generating label:', { template_id, product: data.name });

    // Generate HTML
    const html = generateLabelHTML(template_id, data, options);

    // For now, we'll return the HTML directly
    // In a production environment, you would use Puppeteer to convert to PDF
    const mockPdfBase64 = btoa(`PDF-${template_id}-${data.id}-${Date.now()}`);

    return new Response(JSON.stringify({
      pdf_base64: mockPdfBase64,
      html: html // Include for debugging
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating label:', error);
    return new Response(JSON.stringify({ 
      error: (error as any)?.message || 'Failed to generate label' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});