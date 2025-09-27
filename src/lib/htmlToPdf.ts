import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { snapMm, snapSizeMm } from './dotGrid';

interface PDFOptions {
  width_mm: number;
  height_mm: number;
  margin_mm: number;
  dpi?: number;
  scale?: number;
}

export async function htmlToPdfBase64(html: string, options: PDFOptions): Promise<string> {
  const { width_mm, height_mm, margin_mm, dpi = 300, scale = 4 } = options;
  
  // Snap dimensions to dot grid for precision
  const snappedWidth = snapSizeMm(width_mm);
  const snappedHeight = snapSizeMm(height_mm);
  const snappedMargin = snapMm(margin_mm);
  
  // Validate input parameters
  if (!snappedWidth || snappedWidth <= 0 || !snappedHeight || snappedHeight <= 0) {
    throw new Error(`Invalid label dimensions: ${snappedWidth}mm x ${snappedHeight}mm`);
  }
  
  if (snappedMargin < 0) {
    throw new Error(`Invalid margin: ${snappedMargin}mm`);
  }
  
  // Ensure margins don't exceed half the dimensions to prevent negative content size
  const maxMargin = Math.min(snappedWidth, snappedHeight) / 2;
  const safeMargin = Math.min(snappedMargin, maxMargin);
  
  if (safeMargin !== snappedMargin) {
    console.warn(`Margin reduced from ${snappedMargin}mm to ${safeMargin}mm to fit label dimensions`);
  }
  
  // Create a hidden container for rendering with precise dimensions
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${snappedWidth}mm`;
  container.style.height = `${snappedHeight}mm`;
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.backgroundColor = 'white';
  container.style.fontKerning = 'normal';
  container.style.letterSpacing = '0';
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
    
    // Create PDF with exact snapped dimensions
    const pdf = new jsPDF({
      unit: 'mm',
      format: [snappedWidth, snappedHeight],
      orientation: snappedWidth > snappedHeight ? 'landscape' : 'portrait'
    });
    
    // Calculate content dimensions using safe margins
    const contentWidth = snappedWidth - (2 * safeMargin);
    const contentHeight = snappedHeight - (2 * safeMargin);
    
    // Ensure content dimensions are positive
    if (contentWidth <= 0 || contentHeight <= 0) {
      throw new Error(`Content dimensions too small: ${contentWidth}mm x ${contentHeight}mm. Label: ${snappedWidth}mm x ${snappedHeight}mm, Margin: ${safeMargin}mm`);
    }
    
    try {
      // Add the canvas image to the PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(
        imgData, 
        'JPEG', 
        safeMargin, 
        safeMargin, 
        contentWidth, 
        contentHeight
      );
    } catch (error) {
      throw new Error(`Failed to add image to PDF: ${error.message}. Dimensions: ${contentWidth}mm x ${contentHeight}mm at position ${safeMargin}mm, ${safeMargin}mm`);
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