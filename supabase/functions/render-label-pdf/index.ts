import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { html, width_mm, height_mm, dpi = 300, margin_mm = 0, diagnostic = false } = await req.json();
    
    if (!html) {
      throw new Error('HTML content is required');
    }

    console.log('Gotenberg PDF render request:', {
      width_mm,
      height_mm,
      dpi,
      margin_mm,
      diagnostic,
      html_length: html.length
    });

    // Get Gotenberg URL from secrets
    const gotenbergUrl = Deno.env.get('GOTENBERG_URL');
    if (!gotenbergUrl) {
      throw new Error('GOTENBERG_URL not configured');
    }

    // Prepare HTML with diagnostic CSS if requested
    let finalHtml = html;
    if (diagnostic) {
      const diagnosticCSS = `
        <style>
          .label { border: 0.4mm solid #000 !important; }
          .label.debug * { outline: 0.2mm dashed rgba(0,0,0,.25) !important; }
          .label { background: #fff !important; }
          .content { background: rgba(255,255,0,0.1) !important; }
        </style>
      `;
      finalHtml = finalHtml.replace('</head>', `${diagnosticCSS}</head>`);
      finalHtml = finalHtml.replace('class="label"', 'class="label debug"');
    }

    // Build FormData for Gotenberg API
    const formData = new FormData();
    formData.append('files', new Blob([finalHtml], { type: 'text/html' }), 'index.html');
    formData.append('printBackground', 'true');
    formData.append('preferCssPageSize', 'true');
    formData.append('scale', '1');
    formData.append('emulatedMediaType', 'print');
    formData.append('waitDelay', '150ms'); // Allow time for webfonts to load

    console.log('Calling Gotenberg:', {
      endpoint: `${gotenbergUrl}/forms/chromium/convert/html`,
      printBackground: true,
      preferCssPageSize: true,
      scale: 1
    });

    const response = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gotenberg error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Gotenberg API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Get PDF as array buffer and convert to base64
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log('PDF generated successfully:', {
      pdf_size_bytes: pdfBuffer.byteLength,
      pdf_size_kb: Math.round(pdfBuffer.byteLength / 1024),
      pdf_header: pdfBase64.substring(0, 8),
      is_valid_pdf: pdfBase64.startsWith('JVBERi0'),
      requested_dimensions: `${width_mm}mm x ${height_mm}mm`,
      requested_dpi: dpi,
      margin_mm: margin_mm
    });

    return new Response(
      JSON.stringify({ 
        pdf_base64: pdfBase64,
        server_optimized: true,
        gotenberg: true,
        size_bytes: pdfBuffer.byteLength
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in Gotenberg PDF render:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'PDF rendering failed',
        gotenberg_error: true 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});