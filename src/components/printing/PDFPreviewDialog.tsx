import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface PDFPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBase64: string | null;
  productName: string;
}

export function PDFPreviewDialog({ 
  open, 
  onOpenChange, 
  pdfBase64, 
  productName 
}: PDFPreviewDialogProps) {
  
  const handleViewPDF = () => {
    if (!pdfBase64) {
      toast.error('No PDF available to preview');
      return;
    }

    try {
      // Convert base64 to blob and open in new tab
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Open in new tab for preview
      window.open(url, '_blank', 'noopener');
      
      // Clean up the blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      toast.success('PDF opened in new tab');
    } catch (error) {
      console.error('Error opening PDF:', error);
      toast.error('Failed to open PDF preview');
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfBase64) {
      toast.error('No PDF available to download');
      return;
    }

    try {
      // Convert base64 to blob and download
      const binaryString = atob(pdfBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `label-${productName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const getPDFInfo = () => {
    if (!pdfBase64) return null;
    
    const sizeBytes = Math.round(pdfBase64.length * 0.75); // Base64 is ~33% larger
    const sizeKB = Math.round(sizeBytes / 1024);
    const isValidPDF = pdfBase64.startsWith('JVBERi0'); // PDF header in base64
    
    return { sizeBytes, sizeKB, isValidPDF };
  };

  const pdfInfo = getPDFInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>PDF Preview</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Product: {productName}</p>
            {pdfInfo && (
              <div className="mt-2 space-y-1">
                <p>Size: {pdfInfo.sizeKB} KB ({pdfInfo.sizeBytes.toLocaleString()} bytes)</p>
                <p>Valid PDF: {pdfInfo.isValidPDF ? '✓ Yes' : '✗ No'}</p>
                {!pdfInfo.isValidPDF && (
                  <p className="text-destructive font-medium">⚠ Invalid PDF format detected</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleViewPDF}
              disabled={!pdfBase64 || !pdfInfo?.isValidPDF}
              className="flex-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              View PDF
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={!pdfBase64 || !pdfInfo?.isValidPDF}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>

          {!pdfBase64 && (
            <p className="text-sm text-muted-foreground text-center">
              No PDF available. Generate a label first.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}