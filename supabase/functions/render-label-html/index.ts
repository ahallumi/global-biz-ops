import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RenderRequest {
  html: string;
  width_mm: number;
  height_mm: number;
  dpi?: number;
  margin_mm?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { html, width_mm, height_mm, dpi = 300, margin_mm = 0 }: RenderRequest = await req.json();

    console.log('Server-side PDF render request:', { 
      width_mm, 
      height_mm, 
      dpi, 
      margin_mm,
      html_length: html.length 
    });

    // Launch Puppeteer
    const puppeteer = await import("https://deno.land/x/puppeteer@16.2.0/mod.ts");
    
    const browser = await puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport to match label dimensions (convert mm to pixels at 96 DPI for viewport)
    const viewportWidth = Math.round(width_mm * 96 / 25.4);
    const viewportHeight = Math.round(height_mm * 96 / 25.4);
    
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1
    });

    // Ensure HTML has proper @page settings with zero margins
    const processedHtml = html.replace(
      /@page\s*\{[^}]*\}/g,
      `@page { size: ${width_mm}mm ${height_mm}mm; margin: 0; }`
    );

    console.log('Setting content with zero margins enforced');
    await page.setContent(processedHtml, { waitUntil: 'load' });

    // Generate PDF with exact dimensions and zero margins
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      format: undefined // Let CSS @page size control the format
    });

    await browser.close();

    const pdfBase64 = btoa(String.fromCharCode(...pdf));
    
    console.log('PDF generated successfully:', {
      pdf_bytes: pdf.length,
      base64_length: pdfBase64.length,
      pdf_header: pdfBase64.substring(0, 8)
    });

    return new Response(JSON.stringify({ 
      pdf_base64: pdfBase64,
      dimensions: { width_mm, height_mm, margin_mm: 0 }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error rendering PDF:', error);
    return new Response(JSON.stringify({ 
      error: (error as any)?.message || 'Failed to render PDF' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});