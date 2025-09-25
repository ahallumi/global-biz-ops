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
    
    // Calculate content dimensions (excluding margins)
    const contentWidth = width_mm - (2 * margin_mm);
    const contentHeight = height_mm - (2 * margin_mm);
    
    // Add the canvas image to the PDF
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    pdf.addImage(
      imgData, 
      'JPEG', 
      margin_mm, 
      margin_mm, 
      contentWidth, 
      contentHeight
    );
    
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