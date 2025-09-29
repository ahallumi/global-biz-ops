import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to format barcode data for Code 39
function toCode39Text(raw: string | null | undefined): string {
  // Code 39 allowed: 0-9 A-Z space - . $ / + %
  const allowed = /[0-9A-Z \-.\$\/\+%]/;
  const cleaned = (raw ?? "")
    .toUpperCase()
    .split("")
    .filter(ch => allowed.test(ch))
    .join("");

  // Never return empty; scanners expect start/stop asterisks
  const payload = cleaned || "0";
  return `*${payload}*`;
}

// Helper function to resolve price from multiple possible fields
function resolvePrice(product: any): number | null {
  const candidates = [
    product?.price,
    product?.unit_price,
    product?.retail_price_cents ? product.retail_price_cents / 100 : null,
    product?.price_cents ? product.price_cents / 100 : null
  ];
  
  const value = candidates.find(x => x != null && !Number.isNaN(+x));
  return value == null ? null : +value;
}

// Helper function to format currency (returns empty string for null)
function currencyUSD(price: number | null): string {
  return price == null ? "" : `$${price.toFixed(2)}`;
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

// HTML template renderer with variable substitution
function renderHtmlTemplate(template: string, product: any): string {
  if (!template) return '';

  const barcodeValue = product.barcode || product.sku || product.id?.slice(-8) || '';
  const price = resolvePrice(product);
  
  const substitutions = {
    '{{product.name}}': escapeHtml(product.name || ''),
    '{{product.sku}}': escapeHtml(product.sku || ''),
    '{{product.id}}': escapeHtml(product.id || ''),
    '{{product.brand}}': escapeHtml(product.brand || ''),
    '{{product.size}}': escapeHtml(product.size || ''),
    '{{product.unit}}': escapeHtml(product.unit || 'EA'),
    '{{product.barcode}}': escapeHtml(barcodeValue),
    '{{product.retail_price_cents}}': product.retail_price_cents 
      ? escapeHtml(currencyUSD(product.retail_price_cents / 100)) 
      : '',
    '{{product.default_cost_cents}}': product.default_cost_cents 
      ? escapeHtml(currencyUSD(product.default_cost_cents / 100)) 
      : '',
    '{{product.cost_formatted}}': product.default_cost_cents 
      ? escapeHtml(currencyUSD(product.default_cost_cents / 100)) 
      : '',
    '{{price_formatted}}': escapeHtml(currencyUSD(price)),
    '{{unit_suffix}}': escapeHtml(product.unit ? `/${product.unit}` : ''),
    '{{barcode_svg}}': barcodeValue ? 
      generateBarcodeSVG(barcodeValue, 150, 30) : '',
    '{{barcode_text_code39}}': escapeHtml(toCode39Text(barcodeValue)),
    '{{printed_at}}': escapeHtml(new Date().toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })),
  };

  let rendered = template;
  Object.entries(substitutions).forEach(([key, value]) => {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    rendered = rendered.replace(regex, value);
  });

  // Debug logging
  console.log("LABEL_HTML_SNIP", rendered.slice(0, 500));
  console.log("HAS_CODE39_TOKEN", rendered.includes("{{barcode_text_code39}}") ? "MISSING" : "OK");
  console.log("PRICE_RESOLVED", price, "->", currencyUSD(price));

  // Safety check for missing substitutions
  if (template.includes("{{barcode_text_code39}}") && rendered.includes("{{barcode_text_code39}}")) {
    throw new Error("Template expects {{barcode_text_code39}} but server did not provide it.");
  }

  return rendered;
}
function renderJsonTemplate(template: any, product: any): string {
  const { meta, elements } = template;
  
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
  
  // Generate elements HTML
  const elementsHtml = elements.map((element: any) => {
    const { id, type, x_mm, y_mm, w_mm, h_mm, style = {}, bind, visibility = {} } = element;
    
    // Get the value from binding
    let value = evaluateBinding(bind, product);
    
    // Handle visibility rules
    if (visibility.hide_if_empty && !value) {
      return '';
    }
    
    // Common positioning styles
    const positionStyle = `
      position: absolute;
      left: ${x_mm}mm;
      top: ${y_mm}mm;
      width: ${w_mm}mm;
      height: ${h_mm}mm;
    `;
    
    // Font styles
    const fontStyle = `
      font-family: ${style.font_family || 'Inter'}, sans-serif;
      font-size: ${style.font_size_pt || 10}pt;
      font-weight: ${style.font_weight || 400};
      text-align: ${style.align || 'left'};
      line-height: ${style.line_height || 1.2};
      opacity: ${style.opacity || 1};
    `;
    
    if (type === 'text') {
      return `
        <div style="${positionStyle} ${fontStyle}">
          ${value}
        </div>
      `;
    } else if (type === 'barcode') {
      return `
        <div style="${positionStyle}">
          ${generateBarcode(value, w_mm, h_mm)}
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
          size: ${meta.width_mm}mm ${meta.height_mm}mm; 
          margin: 0; 
        }
        body { 
          width: ${meta.width_mm}mm; 
          height: ${meta.height_mm}mm; 
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
    return `<svg width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="shape-rendering:crispEdges;">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.3em" font-family="Arial, sans-serif" font-size="3mm" fill="black">No barcode</text>
    </svg>`;
  }

  // Determine symbology and generate appropriate pattern
  let symbology = 'CODE128';
  let pattern: number[] = [];
  
  if (/^\d{12,13}$/.test(code)) {
    symbology = 'EAN13';
    // EAN-13 simplified pattern
    pattern = [1,1,1,1,1,1,1,1,1,1,1,1,1]; // Placeholder - would need real EAN-13 implementation
  } else if (/^\d{11,12}$/.test(code)) {
    symbology = 'UPCA';
    // UPC-A simplified pattern
    pattern = [1,1,1,1,1,1,1,1,1,1,1,1]; // Placeholder - would need real UPC-A implementation
  } else {
    // Code128 pattern generation (simplified)
    for (let i = 0; i < code.length; i++) {
      const charCode = code.charCodeAt(i);
      pattern.push((charCode % 3) + 1, (charCode % 2) + 1);
    }
  }

  // Calculate dimensions with proper dot-grid precision (300 DPI = ~0.08467mm per dot)
  const DOT_MM = 25.4 / 300; // 0.08467mm per dot at 300 DPI
  const moduleWidthMm = Math.max(DOT_MM * 4, 0.33); // At least 4 dots wide for reliability
  const quietZoneMm = Math.max(DOT_MM * 12, 1.0); // At least 12 dots (1mm) quiet zone
  const patternWidthMm = pattern.reduce((sum, w) => sum + w, 0) * moduleWidthMm;
  const totalWidthMm = patternWidthMm + (2 * quietZoneMm);
  
  // Generate bars with integer-dot precision for crisp printing
  let x = quietZoneMm;
  const bars: string[] = [];
  
  for (let i = 0; i < pattern.length; i++) {
    const barWidthMm = pattern[i] * moduleWidthMm;
    
    if (i % 2 === 0) { // Even indices are bars (black)
      bars.push(`<rect x="${x.toFixed(3)}" y="0" width="${barWidthMm.toFixed(3)}" height="${(height * 0.8).toFixed(3)}" fill="black"/>`);
    }
    
    x += barWidthMm;
  }

  return `<svg width="${width}mm" height="${height}mm" viewBox="0 0 ${totalWidthMm} ${height}" xmlns="http://www.w3.org/2000/svg" style="shape-rendering:crispEdges;" preserveAspectRatio="none">
    <rect width="100%" height="100%" fill="white"/>
    ${bars.join('\n    ')}
    <text x="${totalWidthMm / 2}" y="${height * 0.95}" text-anchor="middle" font-family="Arial, sans-serif" font-size="2mm" fill="black">${code}</text>
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
        margin: 0; 
      }
      html, body { 
        width: ${width_mm}mm; 
        height: ${height_mm}mm; 
        margin: 0; 
        padding: 0;
        font-family: Arial, sans-serif;
        background: #fff;
      }
      * { 
        box-sizing: border-box; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
      .label { 
        position: relative; 
        width: ${width_mm}mm; 
        height: ${height_mm}mm; 
      }
      .content { 
        position: absolute; 
        left: 1mm; 
        top: 1mm; 
        width: ${width_mm - 2}mm; 
        height: ${height_mm - 2}mm; 
        overflow: hidden; 
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="content">
        <div style="text-align: center; padding: 2mm;">
          <h3 style="margin: 0 0 2mm 0; font-size: 8pt;">${data.name}</h3>
          <p style="margin: 0 0 2mm 0; font-size: 7pt;">${price}</p>
          <div>${barcodeSVG}</div>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_id, product, profile_id, use_json_template, diagnostic, options } = await req.json();
    console.log('Generating label:', { 
      template_id, 
      product: product?.name || 'Unknown', 
      use_json_template, 
      diagnostic,
      options 
    });

    let html = '';
    
    // Extract dimensions from options or use defaults
    const labelOptions: LabelOptions = {
      width_mm: options?.width_mm || 62,
      height_mm: options?.height_mm || 29,
      dpi: options?.dpi || 300,
      margin_mm: options?.margin_mm !== undefined ? options.margin_mm : 2
    };
    
    console.log('Label options:', labelOptions);
    
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
        .select('layout, template_type, html_template')
        .eq('profile_id', profile_id || template_id)
        .eq('is_active', true)
        .single();

      if (template && !error) {
        if (template.template_type === 'html' && template.html_template) {
          console.log('Using HTML template for rendering');
          let templateHtml = template.html_template;
          
          // Validate and wrap HTML if needed
          const needsWrapping = 
            templateHtml.length < 100 || 
            !templateHtml.includes('@page') || 
            !templateHtml.includes('<!DOCTYPE');
          
          if (needsWrapping) {
            console.warn('HTML template is minimal or missing structure - auto-wrapping with proper sizing');
            
            // Wrap minimal content in proper HTML skeleton with correct dimensions
            const wrappedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { 
          size: ${labelOptions.width_mm}mm ${labelOptions.height_mm}mm; 
          margin: ${labelOptions.margin_mm}mm; 
        }
        html, body { 
          width: ${labelOptions.width_mm}mm; 
          height: ${labelOptions.height_mm}mm; 
          margin: 0; 
          padding: ${labelOptions.margin_mm}mm;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        }
        .label {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        * { 
          box-sizing: border-box; 
          -webkit-print-color-adjust: exact; 
          print-color-adjust: exact; 
        }
      </style>
    </head>
    <body>
      <div class="label">
        ${templateHtml}
      </div>
    </body>
    </html>`;
            
            templateHtml = wrappedHtml;
          }
          
          // Apply diagnostic mode modifications if requested
          if (diagnostic) {
            console.log('Applying diagnostic mode modifications');
            
            // Add diagnostic CSS
            const diagnosticCSS = `
              <style>
                body, .label, .content { background:#fff !important; }
                * { color:#000 !important; }
                .label { border:0.4mm solid #000 !important; }
                .label.debug * { outline: 0.2mm dashed rgba(0,0,0,.25) !important; }
              </style>
            `;
            
            // Inject diagnostic styles before closing head tag
            if (templateHtml.includes('</head>')) {
              templateHtml = templateHtml.replace('</head>', `${diagnosticCSS}</head>`);
            }
            
            // Add debug class to label
            templateHtml = templateHtml.replace(
              'class="label"',
              'class="label debug"'
            );
          }
          
          html = renderHtmlTemplate(templateHtml, product);
        } else if (template.layout) {
          console.log('Using JSON template for rendering');
          html = renderJsonTemplate(template.layout, product);
        } else {
          throw new Error('Template has no valid content');
        }
      } else {
        console.log('No JSON template found, falling back to legacy templates');
        // Fall back to legacy templates with client options
        const data = {
          id: product.id || 'unknown',
          name: product.name || 'Unknown Product',
          sku: product.sku || null,
          barcode: product.barcode || null,
          price: product.price || null,
          size: product.size || null,
          unit: product.unit || 'ea'
        };
        
        if (template_id === 'custom-62x29-landscape') {
          html = generateLabelHTML('brother-29x90-product', data, labelOptions);
        } else if (template_id === 'custom-29x62-portrait') {
          html = generateLabelHTML('brother-62x100-shelf', data, labelOptions);
        } else if (template_id === 'calibration-grid') {
          html = generateLabelHTML('calibration-grid', data, labelOptions);
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
      
      if (template_id === 'custom-62x29-landscape') {
        html = generateLabelHTML('brother-29x90-product', data, labelOptions);
      } else if (template_id === 'custom-29x62-portrait') {
        html = generateLabelHTML('brother-62x100-shelf', data, labelOptions);
      } else if (template_id === 'calibration-grid') {
        html = generateLabelHTML('calibration-grid', data, labelOptions);
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