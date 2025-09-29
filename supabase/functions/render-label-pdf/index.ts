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

    console.log('Browserless PDF render request:', {
      width_mm,
      height_mm,
      dpi,
      margin_mm,
      diagnostic,
      html_length: html.length
    });

    // Get Browserless token from secrets
    const browserlessToken = Deno.env.get('BROWSERLESS_TOKEN');
    if (!browserlessToken) {
      throw new Error('Browserless token not configured');
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

    // Call Browserless Cloud API for PDF generation
    const browserlessUrl = `https://production-sfo.browserless.io/pdf?token=${browserlessToken}`;
    
    const pdfOptions = {
      html: finalHtml,
      options: {
        width: `${width_mm}mm`,
        height: `${height_mm}mm`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: `${margin_mm}mm`,
          right: `${margin_mm}mm`, 
          bottom: `${margin_mm}mm`,
          left: `${margin_mm}mm`
        },
        displayHeaderFooter: false,
        format: 'A4' // Will be overridden by width/height
      },
      gotoOptions: {
        waitUntil: 'networkidle2',
        timeout: 30000
      }
    };

    console.log('Calling Browserless with options:', {
      width: pdfOptions.options.width,
      height: pdfOptions.options.height,
      margin: pdfOptions.options.margin
    });

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(pdfOptions)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Browserless error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Browserless API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Get PDF as array buffer and convert to base64
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log('PDF generated successfully:', {
      pdf_size_bytes: pdfBuffer.byteLength,
      pdf_size_kb: Math.round(pdfBuffer.byteLength / 1024),
      pdf_header: pdfBase64.substring(0, 8),
      is_valid_pdf: pdfBase64.startsWith('JVBERi0')
    });

    return new Response(
      JSON.stringify({ 
        pdf_base64: pdfBase64,
        server_optimized: true,
        browserless: true,
        size_bytes: pdfBuffer.byteLength
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in Browserless PDF render:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'PDF rendering failed',
        browserless_error: true 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});