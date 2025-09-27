import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { htmlToPdfBase64 } from '@/lib/htmlToPdf';
import { generatePrintOptions, validateBrotherProfile } from "@/lib/paperMatching";

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
          data: product,
          options: {
            width_mm: activeProfile.width_mm,
            height_mm: activeProfile.height_mm,
            dpi: activeProfile.dpi,
            margin_mm: activeProfile.margin_mm
          }
        }
      });

      if (labelError) throw labelError;

      // Generate PDF from HTML if not provided
      let pdfBase64 = labelData.pdf_base64;
      if (!pdfBase64 && labelData.html) {
        pdfBase64 = await htmlToPdfBase64(labelData.html, {
          width_mm: labelData.width_mm,
          height_mm: labelData.height_mm,
          margin_mm: labelData.margin_mm,
          dpi: labelData.dpi
        });
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
      
      // Validate Brother profile and generate print options
      const validation = validateBrotherProfile(activeProfile.width_mm, activeProfile.height_mm);
      if (!validation.isValid && validation.warning) {
        console.warn('Brother profile validation:', validation.warning);
      }

      const { options: printOptions, warnings } = generatePrintOptions(
        selectedPrinter?.capabilities,
        activeProfile.width_mm,
        activeProfile.height_mm,
        activeProfile.dpi
      );

      // Show warnings to user
      warnings.forEach(warning => {
        toast.warning(warning, { duration: 5000 });
      });

      // Print label
      const { data: printData, error: printError } = await supabase.functions.invoke('printnode-print', {
        body: {
          printer_id: targetPrinterId,
          title: `Label: ${product.name}`,
          base64: pdfBase64,
          source: 'label-print',
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
    printers,
    
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