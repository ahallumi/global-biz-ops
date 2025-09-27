import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Dot Grid Precision Constants
const DPI = 300;
const MM_PER_IN = 25.4;
const DOT_MM = MM_PER_IN / DPI; // ≈ 0.084666... mm per dot

// Precision snapping functions
function snapMm(mm: number, dots: number = 1): number {
  const dotsFloat = mm / DOT_MM;
  const snappedDots = Math.round(dotsFloat / dots) * dots;
  return snappedDots * DOT_MM;
}

function snapSizeMm(mm: number): number {
  const dots = Math.max(1, Math.round(mm / DOT_MM));
  return dots * DOT_MM;
}

function moduleMmFromDesired(desiredMm: number): number {
  const dots = Math.max(2, Math.round(desiredMm / DOT_MM));
  return dots * DOT_MM;
}

// Precision barcode generator with integer-dot modules
function generatePrecisionBarcode(value: string, width_mm: number, height_mm: number, module_width_mm: number): string {
  if (!value || value.trim() === '') {
    return `<div style="width: ${width_mm}mm; height: ${height_mm}mm; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999;">No barcode</div>`;
  }

  // Simple Code128-style pattern generation with precision module width
  const bars = value.split('').map((char) => {
    const charCode = char.charCodeAt(0);
    return (charCode % 4) + 1; // Simple pattern generation
  });

  const actualModuleWidth = moduleMmFromDesired(module_width_mm);
  const barWidth = actualModuleWidth;
  let x = 0;
  let barsHTML = '';

  for (const barHeight of bars) {
    barsHTML += `<rect x="${x}" y="0" width="${barWidth}" height="${height_mm * 0.8}" fill="black"/>`;
    x += barWidth * 3;
  }

  return `<svg width="${width_mm}mm" height="${height_mm}mm" viewBox="0 0 ${width_mm} ${height_mm}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <rect width="100%" height="100%" fill="white"/>
    ${barsHTML}
    <text x="50%" y="${height_mm * 0.95}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2mm" fill="black">${value}</text>
  </svg>`;
}

// Simple barcode generator for Code128 using HTML/CSS
function generateBarcode(value: string, width: number, height: number): string {
  // This is a simplified barcode representation
  // In production, you'd want to use a proper barcode library
  const barcodeValue = value || '123456789012';
  const bars = [];
  
  // Generate simple pattern for demonstration
  for (let i = 0; i < barcodeValue.length; i++) {
    const digit = parseInt(barcodeValue[i]) || 0;
    bars.push(`<div style="width: ${(digit % 3) + 1}px; height: ${height}px; background: black; display: inline-block; margin-right: 1px;"></div>`);
  }
  
  return `
    <div style="width: ${width}mm; text-align: center;">
      <div style="display: flex; justify-content: center; align-items: flex-end; height: ${height}mm;">
        ${bars.join('')}
      </div>
      <div style="font-size: 8px; margin-top: 2px;">${barcodeValue}</div>
    </div>
  `;
}

// Template JSON renderer
function renderJsonTemplate(template: any, product: any, options: { width_mm: number, height_mm: number }): string {
  const { meta, elements } = template;
  
  // Apply dot-grid snapping to meta dimensions
  const snappedWidth = snapSizeMm(meta.width_mm || options.width_mm);
  const snappedHeight = snapSizeMm(meta.height_mm || options.height_mm);
  
  // Helper function to evaluate bindings
  function evaluateBinding(bind: string, product: any): string {
    if (!bind) return '';
    
    // Handle simple property access like "product.name"
    if (bind.startsWith('product.')) {
      const prop = bind.substring(8);
      let value = product[prop] || '';
      
      // Handle filters
      if (bind.includes('| currency(')) {
        const match = bind.match(/\| currency\('(.+?)'\)/);
        if (match) {
          const symbol = match[1];
          return `${symbol}${parseFloat(value).toFixed(2)}`;
        }
      }
      
      if (bind.includes('| uppercase')) {
        return String(value).toUpperCase();
      }
      
      return String(value);
    }
    
    return bind;
  }
  
  // Generate elements HTML with precision snapping
  const elementsHtml = elements.map((element: any) => {
    const { id, type, x_mm, y_mm, w_mm, h_mm, style = {}, bind, visibility = {} } = element;
    
    // Snap element dimensions to dot grid
    const snappedX = snapMm(x_mm);
    const snappedY = snapMm(y_mm);
    const snappedW = snapSizeMm(w_mm);
    const snappedH = snapSizeMm(h_mm);
    
    // Get the value from binding
    let value = evaluateBinding(bind, product);
    
    // Handle visibility rules
    if (visibility.hide_if_empty && !value) {
      return '';
    }
    
    // Common positioning styles
    const positionStyle = `
      position: absolute;
      left: ${snappedX}mm;
      top: ${snappedY}mm;
      width: ${snappedW}mm;
      height: ${snappedH}mm;
    `;
    
    // Font styles with precision
    const fontStyle = `
      font-family: ${style.font_family || 'Inter'}, sans-serif;
      font-size: ${style.font_size_pt || 10}pt;
      font-weight: ${style.font_weight || 400};
      text-align: ${style.align || 'left'};
      line-height: ${style.line_height || 1.2};
      opacity: ${style.opacity || 1};
      font-kerning: normal;
      letter-spacing: 0;
    `;
    
    if (type === 'text') {
      return `
        <div style="${positionStyle} ${fontStyle}">
          ${value}
        </div>
      `;
    } else if (type === 'barcode') {
      // Generate precision barcode with proper module width
      const moduleWidth = moduleMmFromDesired(element.barcode?.module_width_mm || 0.33);
      return `
        <div style="${positionStyle}">
          ${generatePrecisionBarcode(value, snappedW, snappedH, moduleWidth)}
        </div>
      `;
    }
    
    return '';
  }).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { 
          size: ${snappedWidth}mm ${snappedHeight}mm; 
          margin: 0; 
        }
        body { 
          width: ${snappedWidth}mm; 
          height: ${snappedHeight}mm; 
          margin: 0; 
          padding: 0; 
          background: ${meta.bg || '#FFFFFF'};
          position: relative;
          font-family: Inter, sans-serif;
        }
        * { 
          box-sizing: border-box; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact;
          font-kerning: normal;
          letter-spacing: 0;
        }
      </style>
    </head>
    <body>
      ${elementsHtml}
    </body>
    </html>
  `;
}

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

function generateLabelHTML(template_id: string, data: LabelData, options: LabelOptions): string {
  const { width_mm, height_mm, margin_mm } = options;
  const barcodeCode = data.barcode || data.sku || data.id.slice(-8);
  const price = data.price ? `$${data.price.toFixed(2)}` : 'Price N/A';
  const barcodeSVG = generateBarcodeSVG(barcodeCode, 150, 30);

  if (template_id === 'brother-29x90-product') {
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

  if (template_id === 'brother-62x100-shelf') {
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

  if (template_id === 'calibration-grid') {
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
          padding: 0;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        }
        .calibration-grid {
          width: 100%;
          height: 100%;
          position: relative;
          background: white;
          border: 1px solid black;
        }
        .grid-lines {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(to right, #ddd 1px, transparent 1px),
            linear-gradient(to bottom, #ddd 1px, transparent 1px);
          background-size: 5mm 5mm;
        }
        .corner-marks {
          position: absolute;
        }
        .corner-marks::before {
          content: '';
          position: absolute;
          top: 2mm;
          left: 2mm;
          width: 5mm;
          height: 1px;
          background: black;
        }
        .corner-marks::after {
          content: '';
          position: absolute;
          top: 2mm;
          left: 2mm;
          width: 1px;
          height: 5mm;
          background: black;
        }
        .dimensions {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 8px;
          font-weight: bold;
          text-align: center;
          background: white;
          padding: 2mm;
          border: 1px solid black;
        }
      </style>
    </head>
    <body>
      <div class="calibration-grid">
        <div class="grid-lines"></div>
        <div class="corner-marks"></div>
        <div class="dimensions">
          ${width_mm}mm × ${height_mm}mm<br>
          DPI: ${options.dpi || 300}<br>
          Margin: ${margin_mm}mm<br>
          5mm Grid
        </div>
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
    const { template_id, product, profile_id, use_json_template } = await req.json();
    console.log('Generating label:', { template_id, product: product?.name || 'Unknown', use_json_template });

    let html = '';
    
    // Check if we should use JSON template
    if (use_json_template || profile_id) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      );

      // Get the active template for the profile
      const { data: template, error } = await supabaseClient
        .from('label_templates')
        .select('layout')
        .eq('profile_id', profile_id || template_id)
        .eq('is_active', true)
        .single();

      if (template && !error) {
        console.log('Using JSON template for rendering');
        html = renderJsonTemplate(template.layout, product, { width_mm: 62, height_mm: 29 });
      } else {
        console.log('No JSON template found, falling back to legacy templates');
        // Fall back to legacy templates
        const data = {
          id: product.id || 'unknown',
          name: product.name || 'Unknown Product',
          sku: product.sku || null,
          barcode: product.barcode || null,
          price: product.price || null,
          size: product.size || null,
          unit: product.unit || 'ea'
        };
        const options = { width_mm: 62, height_mm: 29, dpi: 300, margin_mm: 2 };
        
      if (template_id === 'custom-62x29-landscape') {
        html = generateLabelHTML('brother-29x90-product', data, options);
      } else if (template_id === 'custom-29x62-portrait') {
        html = generateLabelHTML('brother-62x100-shelf', data, options);
      } else if (template_id === 'calibration-grid') {
        html = generateLabelHTML('calibration-grid', data, options);
      } else {
        throw new Error(`Unknown template: ${template_id}`);
      }
      }
    } else {
      // Legacy template generation - convert product to expected format
      const data = {
        id: product.id || 'unknown',
        name: product.name || 'Unknown Product',
        sku: product.sku || null,
        barcode: product.barcode || null,
        price: product.price || null,
        size: product.size || null,
        unit: product.unit || 'ea'
      };
      const options = { width_mm: 62, height_mm: 29, dpi: 300, margin_mm: 2 };
      
      if (template_id === 'custom-62x29-landscape') {
        html = generateLabelHTML('brother-29x90-product', data, options);
      } else if (template_id === 'custom-29x62-portrait') {
        html = generateLabelHTML('brother-62x100-shelf', data, options);
      } else if (template_id === 'calibration-grid') {
        html = generateLabelHTML('calibration-grid', data, options);
      } else {
        throw new Error(`Unknown template: ${template_id}`);
      }
    }

    return new Response(
      JSON.stringify({ html }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating label:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});