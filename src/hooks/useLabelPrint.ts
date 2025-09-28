import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { htmlToPdfBase64 } from '@/lib/htmlToPdf';
import { generatePrintOptions, validateBrotherProfile } from "@/lib/paperMatching";
import { getOptimalPrintMode, validateBrotherPrinting, detectMediaType } from "@/lib/brotherPrinterDetection";

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

interface LabelConfig {
  active_profile_id: string;
  profiles: Array<{
    id: string;
    label_name: string;
    template_id: string;
    width_mm: number;
    height_mm: number;
    dpi: number;
    margin_mm: number;
  }>;
  print_on_enter: boolean;
  beep_on_success: boolean;
  preview_before_print: boolean;
  default_printer_id: string | null;
}

interface Printer {
  id: string;
  name: string;
  make_and_model: string;
  default: boolean;
  status: string;
  capabilities?: {
    papers?: Record<string, [number | null, number | null]>;
    dpis?: string[];
    supports_custom_paper_size?: boolean;
  };
}

export function useLabelPrint(stationId?: string) {
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lastPrintedProduct, setLastPrintedProduct] = useState<Product | null>(null);

  // Get label printing configuration
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['label-config', stationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-label-print-config', {
        body: { station_id: stationId }
      });
      
      if (error) throw error;
      return data.config as LabelConfig;
    }
  });

  // Search products
  const searchProducts = useMutation({
    mutationFn: async (searchQuery: string) => {
      const { data, error } = await supabase.functions.invoke('search-products', {
        body: { q: searchQuery }
      });
      
      if (error) throw error;
      return data.products as Product[];
    }
  });

  // Get available printers
  const { data: printers, isLoading: printersLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('printnode-printers');
      
      if (error) throw error;
      return data;
    }
  });

  // Generate and print label
  const printLabel = useMutation({
    mutationFn: async ({ 
      product, 
      printerId 
    }: { 
      product: Product; 
      printerId?: string; 
    }) => {
      if (!config) throw new Error('Configuration not loaded');
      
      const activeProfile = config.profiles.find(p => p.id === config.active_profile_id);
      if (!activeProfile) throw new Error('Active profile not found');

      // Generate label
      const { data: labelData, error: labelError } = await supabase.functions.invoke('generate-label', {
        body: {
          template_id: activeProfile.template_id,
          product: product,
          options: {
            width_mm: activeProfile.width_mm,
            height_mm: activeProfile.height_mm,
            dpi: activeProfile.dpi,
            margin_mm: activeProfile.margin_mm
          }
        }
      });

      if (labelError) throw labelError;

      // Apply station calibration before PDF generation
      const stationId = localStorage.getItem('station-id');
      let calibrationOptions = {
        width_mm: activeProfile.width_mm,
        height_mm: activeProfile.height_mm,
        margin_mm: activeProfile.margin_mm,
        dpi: activeProfile.dpi
      };
      let stationCalibration: any = null;

      if (stationId) {
        try {
          const { data: calibration } = await supabase
            .from('label_print_overrides')
            .select('scale_x, scale_y, offset_x_mm, offset_y_mm')
            .eq('station_id', stationId)
            .eq('profile_id', activeProfile.id)
            .single();

          if (calibration) {
            stationCalibration = calibration;
            // Apply calibration scaling to dimensions
            calibrationOptions = {
              ...calibrationOptions,
              width_mm: calibrationOptions.width_mm * (calibration.scale_x || 1.0),
              height_mm: calibrationOptions.height_mm * (calibration.scale_y || 1.0),
            };
            
            console.log('Applied station calibration:', calibration);
          }
        } catch (error) {
          console.log('No calibration found for station:', stationId);
        }
      }

      // Generate PDF from HTML if not provided
      let pdfBase64 = labelData.pdf_base64;
      if (!pdfBase64 && labelData.html) {
        pdfBase64 = await htmlToPdfBase64(labelData.html, calibrationOptions);
      }

      if (!pdfBase64) {
        throw new Error('Failed to generate PDF for printing');
      }

      // Determine printer ID
      const targetPrinterId = printerId || 
        localStorage.getItem('last-printer-id') || 
        config.default_printer_id;

      if (!targetPrinterId) {
        throw new Error('No printer selected. Please select a printer first.');
      }

      // Get selected printer capabilities
      const selectedPrinter = printers?.printers?.find(p => p.id === targetPrinterId);
      
      if (!selectedPrinter) {
        throw new Error('Selected printer not found');
      }

      // Determine optimal print mode (RAW for Brother QL, PDF for others)
      const printMode = getOptimalPrintMode(selectedPrinter);
      console.log(`Using ${printMode} mode for printer:`, selectedPrinter.name);

      let printBase64 = pdfBase64;
      let contentType: 'pdf_base64' | 'raw_base64' = 'pdf_base64';
      let printOptions = {};

      if (printMode === 'raw_raster') {
        // Use Brother RAW raster mode
        const brotherValidation = validateBrotherPrinting(
          selectedPrinter, 
          activeProfile.width_mm, 
          activeProfile.height_mm
        );

        // Show Brother-specific warnings
        brotherValidation.warnings.forEach(warning => {
          toast.warning(warning, { duration: 7000 });
        });

        // Generate RAW raster data
        const { data: rasterData, error: rasterError } = await supabase.functions.invoke('brother-raster-encoder', {
          body: {
            html: labelData.html,
            width_mm: calibrationOptions.width_mm,
            height_mm: calibrationOptions.height_mm,
            media_type: brotherValidation.mediaType,
            calibration: stationId ? {
              scale_x: stationCalibration?.scale_x,
              scale_y: stationCalibration?.scale_y,
              offset_x_mm: stationCalibration?.offset_x_mm,
              offset_y_mm: stationCalibration?.offset_y_mm
            } : undefined
          }
        });

        if (rasterError) {
          console.error('RAW raster generation failed, falling back to PDF mode:', rasterError);
          toast.warning('RAW printing failed, using PDF mode as fallback');
        } else {
          printBase64 = rasterData.raw_base64;
          contentType = 'raw_base64';
          printOptions = {}; // No options for RAW mode
          console.log('Generated RAW raster data:', {
            bitmap_size: `${rasterData.bitmap_width}x${rasterData.bitmap_height}`,
            command_size: rasterData.command_size
          });
        }
      }

      // Fallback to PDF mode if RAW failed or not Brother printer
      if (contentType === 'pdf_base64') {
        // Validate Brother profile and generate print options  
        const validation = validateBrotherProfile(activeProfile.width_mm, activeProfile.height_mm);
        if (!validation.isValid && validation.warning) {
          console.warn('Brother profile validation:', validation.warning);
        }

        const { options: pdfPrintOptions, warnings } = generatePrintOptions(
          selectedPrinter.capabilities,
          activeProfile.width_mm,
          activeProfile.height_mm,
          activeProfile.dpi
        );

        printOptions = pdfPrintOptions;

        // Show warnings to user
        warnings.forEach(warning => {
          toast.warning(warning, { duration: 5000 });
        });
      }

      // Print label
      const { data: printData, error: printError } = await supabase.functions.invoke('printnode-print', {
        body: {
          printer_id: targetPrinterId,
          title: `Label: ${product.name}`,
          base64: printBase64,
          source: 'label-print',
          content_type: contentType,
          options: printOptions
        }
      });

      if (printError) throw printError;

      // Store last printer for future use
      localStorage.setItem('last-printer-id', targetPrinterId);
      
      return { ...printData, printer_id: targetPrinterId };
    },
    onSuccess: (data, variables) => {
      const printerName = printers?.printers?.find(p => p.id === data.printer_id)?.name || 'Unknown Printer';
      
      toast.success(`Printed "${variables.product.name}" on ${printerName} (Job #${data.job_id})`);

      // Beep if enabled
      if (config?.beep_on_success) {
        // Simple beep using Web Audio API
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
          
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
          console.warn('Could not play beep:', error);
        }
      }

      setLastPrintedProduct(variables.product);
      setSelectedProduct(null);
      setQuery('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to print label');
    }
  });

  // Search handler with debouncing
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim()) {
      searchProducts.mutate(searchQuery);
    } else {
      searchProducts.reset();
    }
  }, [searchProducts]);

  // Quick print handler (for Enter key or exact barcode matches)
  const handleQuickPrint = useCallback((product: Product, printerId?: string) => {
    if (config?.preview_before_print) {
      setSelectedProduct(product);
    } else {
      printLabel.mutate({ product, printerId });
    }
  }, [config, printLabel]);

  return {
    // State
    query,
    selectedProduct,
    lastPrintedProduct,
    config,
    printers: printers?.printers || [],
    
    // Loading states
    configLoading,
    printersLoading,
    searchLoading: searchProducts.isPending,
    printLoading: printLabel.isPending,
    
    // Data
    searchResults: searchProducts.data || [],
    
    // Actions
    handleSearch,
    handleQuickPrint,
    printLabel: printLabel.mutate,
    setSelectedProduct,
    
    // Utils
    getLastPrinterId: () => localStorage.getItem('last-printer-id'),
    setLastPrinterId: (id: string) => localStorage.setItem('last-printer-id', id),
  };
}