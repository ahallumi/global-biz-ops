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
  
  // Create a hidden container for rendering
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${width_mm}mm`;
  container.style.height = `${height_mm}mm`;
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.backgroundColor = 'white';
  container.innerHTML = html;
  
  document.body.appendChild(container);
  
  try {
    // Use html2canvas to render the HTML at high resolution
    const canvas = await html2canvas(container, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: 'white',
      logging: false,
      width: container.offsetWidth,
      height: container.offsetHeight
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
    return pdfBase64;
    
  } finally {
    // Clean up
    document.body.removeChild(container);
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