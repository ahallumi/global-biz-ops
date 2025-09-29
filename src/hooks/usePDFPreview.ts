import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  upc: string | null;
  barcode: string | null;
  price: number | null;
  size: string | null;
  unit: string;
}

interface LabelProfile {
  id: string;
  template_id: string;
  width_mm: number;
  height_mm: number;
  dpi: number;
  margin_mm: number;
}

interface UsePDFPreviewProps {
  activeProfile: LabelProfile | null;
  diagnostic?: boolean;
}

export function usePDFPreview({ activeProfile, diagnostic = false }: UsePDFPreviewProps) {
  const [previewPDF, setPreviewPDF] = useState<string | null>(null);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);

  // Generate PDF for preview
  const generatePreviewPDF = useMutation({
    mutationFn: async (product: Product) => {
      if (!activeProfile) throw new Error('No active profile available');

      console.log('Generating PDF preview for:', {
        product: product.name,
        profile: activeProfile.id,
        dimensions: `${activeProfile.width_mm}x${activeProfile.height_mm}mm`,
        diagnostic
      });

      // Generate label HTML
      const { data: labelData, error: labelError } = await supabase.functions.invoke('generate-label', {
        body: {
          template_id: activeProfile.template_id,
          profile_id: activeProfile.id,
          product: product,
          options: {
            width_mm: activeProfile.width_mm,
            height_mm: activeProfile.height_mm,
            dpi: activeProfile.dpi,
            margin_mm: activeProfile.margin_mm
          },
          diagnostic
        }
      });

      if (labelError) throw labelError;
      if (!labelData.html) throw new Error('No HTML generated');

      // Generate PDF using server-side Gotenberg rendering
      const { data: renderData, error: renderError } = await supabase.functions.invoke('render-label-pdf', {
        body: {
          html: labelData.html,
          width_mm: activeProfile.width_mm,
          height_mm: activeProfile.height_mm,
          dpi: activeProfile.dpi,
          margin_mm: 0,
          diagnostic
        }
      });

      if (renderError) {
        throw new Error(`PDF generation failed: ${renderError.message}`);
      }

      if (!renderData?.pdf_base64) {
        throw new Error('Server did not return a PDF');
      }

      console.log('PDF preview generated:', {
        size_bytes: Math.round(renderData.pdf_base64.length * 0.75),
        is_valid: renderData.pdf_base64.startsWith('JVBERi0'),
        diagnostic_mode: diagnostic
      });

      return renderData.pdf_base64;
    },
    onSuccess: (pdfBase64, product) => {
      setPreviewPDF(pdfBase64);
      setCurrentProduct(product);
      toast.success(`PDF preview generated for "${product.name}"`);
    },
    onError: (error: any) => {
      console.error('PDF preview error:', error);
      toast.error(`Failed to generate PDF preview: ${error.message}`);
      setPreviewPDF(null);
      setCurrentProduct(null);
    }
  });

  const clearPreview = useCallback(() => {
    setPreviewPDF(null);
    setCurrentProduct(null);
  }, []);

  return {
    // State
    previewPDF,
    currentProduct,
    
    // Loading state
    isGenerating: generatePreviewPDF.isPending,
    
    // Actions
    generatePreview: generatePreviewPDF.mutate,
    clearPreview,
    
    // Utils
    hasPreview: !!previewPDF,
    isValidPDF: previewPDF ? previewPDF.startsWith('JVBERi0') : false,
    previewSizeKB: previewPDF ? Math.round(previewPDF.length * 0.75 / 1024) : 0
  };
}