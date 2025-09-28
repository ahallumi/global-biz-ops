import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFOptions {
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  dpi?: number;
  scale?: number;
}

export async function htmlToPdfBase64(html: string, options: PDFOptions): Promise<string> {
  const { width_mm, height_mm, margin_mm, scale = 4 } = options;
  
  // Validate input parameters
  if (!width_mm || width_mm <= 0 || !height_mm || height_mm <= 0) {
    throw new Error(`Invalid label dimensions: ${width_mm}mm x ${height_mm}mm`);
  }
  
  if (margin_mm < 0) {
    throw new Error(`Invalid margin: ${margin_mm}mm`);
  }
  
  // Ensure margins don't exceed half the dimensions to prevent negative content size
  const maxMargin = Math.min(width_mm, height_mm) / 2;
  const safeMargin = Math.min(margin_mm, maxMargin);
  
  if (safeMargin !== margin_mm) {
    console.warn(`Margin reduced from ${margin_mm}mm to ${safeMargin}mm to fit label dimensions`);
  }

  // Debug: Log HTML content for diagnostic
  console.log('PDF_DEBUG: HTML snippet:', html.slice(0, 400));
  console.log('PDF_DEBUG: HTML length:', html.length);
  console.log('PDF_DEBUG: Contains placeholders:', /\{\{[^}]+\}\}/.test(html));
  
  // Inject page size CSS if missing
  let processedHtml = html;
  if (!html.includes('@page')) {
    const pageCSS = `
      <style>
        @page { size: ${width_mm}mm ${height_mm}mm; margin: 0; }
        html, body { width: ${width_mm}mm; height: ${height_mm}mm; margin: 0; padding: 0; background: #fff; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
    `;
    
    if (html.includes('<head>')) {
      processedHtml = html.replace('<head>', `<head>${pageCSS}`);
    } else if (html.includes('<html>')) {
      processedHtml = html.replace('<html>', `<html><head>${pageCSS}</head>`);
    } else {
      processedHtml = `<!DOCTYPE html><html><head>${pageCSS}</head><body>${html}</body></html>`;
    }
  }

  // Create sandboxed iframe for proper rendering
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = `${width_mm}mm`;
  iframe.style.height = `${height_mm}mm`;
  iframe.style.border = 'none';
  iframe.style.backgroundColor = 'white';
  
  document.body.appendChild(iframe);
  
  try {
    // Wait for iframe to load and render content
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('Cannot access iframe document');
    }

    // Write HTML and wait for load
    iframeDoc.open();
    iframeDoc.write(processedHtml);
    iframeDoc.close();

    // Wait for fonts and scripts to load
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Iframe load timeout')), 5000);
      
      iframe.onload = async () => {
        try {
          clearTimeout(timeout);
          // Wait for fonts to be ready
          const iframeWindow = iframe.contentWindow;
          if (iframeWindow?.document?.fonts) {
            await iframeWindow.document.fonts.ready;
          }
          // Small delay for final render
          setTimeout(resolve, 100);
        } catch (error) {
          reject(error);
        }
      };
      
      // Trigger load if already loaded
      if (iframe.contentDocument?.readyState === 'complete') {
        iframe.onload?.(new Event('load') as any);
      }
    });

    const iframeBody = iframeDoc.body;
    if (!iframeBody) {
      throw new Error('Iframe body not found');
    }

    // Use html2canvas to render the iframe content at high resolution
    const canvas = await html2canvas(iframeBody, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: 'white',
      logging: false,
      width: iframeBody.offsetWidth,
      height: iframeBody.offsetHeight
    });
    
    // Create PDF with exact dimensions
    const pdf = new jsPDF({
      unit: 'mm',
      format: [width_mm, height_mm],
      orientation: width_mm > height_mm ? 'landscape' : 'portrait'
    });
    
  // Calculate content dimensions - force zero margins for Brother printer compatibility
  let contentWidth, contentHeight, xPos, yPos;
  
  if (margin_mm === 0) {
    // Force zero margins: content fills entire page for exact size matching
    contentWidth = width_mm;
    contentHeight = height_mm;
    xPos = 0;
    yPos = 0;
    console.log('Using zero margins for Brother compatibility - content fills entire page');
  } else {
    // Use safe margins for other cases
    contentWidth = width_mm - (2 * safeMargin);
    contentHeight = height_mm - (2 * safeMargin);
    xPos = safeMargin;
    yPos = safeMargin;
    
    // Ensure content dimensions are positive
    if (contentWidth <= 0 || contentHeight <= 0) {
      throw new Error(`Content dimensions too small: ${contentWidth}mm x ${contentHeight}mm. Label: ${width_mm}mm x ${height_mm}mm, Margin: ${safeMargin}mm`);
    }
  }
  
  try {
    // Add the canvas image to the PDF
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    pdf.addImage(
      imgData, 
      'JPEG', 
      xPos, 
      yPos, 
      contentWidth, 
      contentHeight
    );
    } catch (error) {
      throw new Error(`Failed to add image to PDF: ${error.message}. Dimensions: ${contentWidth}mm x ${contentHeight}mm at position ${xPos}mm, ${yPos}mm`);
    }
    
    // Return base64 PDF (without data URI prefix)
    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    
    // Debug: Log PDF validation
    console.log('PDF_DEBUG: Generated PDF:', {
      header: pdfBase64.slice(0, 8),
      length: pdfBase64.length,
      valid: pdfBase64.startsWith('JVBERi0'),
      canvas_size: { width: canvas.width, height: canvas.height }
    });
    
    return pdfBase64;
    
  } finally {
    // Clean up
    document.body.removeChild(iframe);
  }
}

// Helper function to create a download link for PDF
export function downloadPdf(base64Data: string, filename: string = 'document.pdf') {
  const link = document.createElement('a');
  link.href = `data:application/pdf;base64,${base64Data}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}