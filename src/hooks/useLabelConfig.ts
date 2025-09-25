import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { htmlToPdfBase64, downloadPdf } from '@/lib/htmlToPdf';

interface LabelProfile {
  id: string;
  label_name: string;
  template_id: string;
  width_mm: number;
  height_mm: number;
  dpi: number;
  margin_mm: number;
  unit: 'mm' | 'inches';
  orientation: 'portrait' | 'landscape';
}

interface LabelConfig {
  active_profile_id: string;
  profiles: LabelProfile[];
  print_on_enter: boolean;
  beep_on_success: boolean;
  preview_before_print: boolean;
  default_printer_id: string | null;
}

interface ConfigUpdate {
  active_profile_id?: string;
  profiles?: LabelProfile[];
  print_on_enter?: boolean;
  beep_on_success?: boolean;
  preview_before_print?: boolean;
  default_printer_id?: string | null;
}

export function useLabelConfig(stationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get configuration
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['label-config', stationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-label-print-config', {
        body: { station_id: stationId }
      });
      
      if (error) throw error;
      return data.config as LabelConfig;
    }
  });

  // Update configuration (admin only)
  const updateConfig = useMutation({
    mutationFn: async (updates: ConfigUpdate) => {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Check if session exists and is valid
      if (sessionError) {
        throw new Error('Authentication error: Please log in again');
      }
      
      if (!session?.access_token) {
        throw new Error('No active session: Please log in as an admin');
      }
      
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session?.access_token) {
          throw new Error('Session expired: Please log in again');
        }
        
        // Use refreshed session
        const { data, error } = await supabase.functions.invoke('update-label-print-config', {
          body: updates,
          headers: {
            Authorization: `Bearer ${refreshData.session.access_token}`,
          },
        });
        
        if (error) {
          if (error.message?.includes('Admin access required') || error.message?.includes('403')) {
            throw new Error('Admin access required: Please log in as an administrator');
          }
          throw error;
        }
        return data;
      }
      
      // Use current session
      const { data, error } = await supabase.functions.invoke('update-label-print-config', {
        body: updates,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        if (error.message?.includes('Admin access required') || error.message?.includes('403')) {
          throw new Error('Admin access required: Please log in as an administrator');
        }
        if (error.message?.includes('Invalid token') || error.message?.includes('401')) {
          throw new Error('Authentication failed: Please log in again');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['label-config'] });
      toast({
        title: 'Settings Updated',
        description: 'Label printing settings have been saved successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update settings',
        variant: 'destructive',
      });
    }
  });

  // Generate calibration PDF
  const generateCalibration = useMutation({
    mutationFn: async (profileId: string) => {
      if (!config) throw new Error('Configuration not loaded');
      
      const profile = config.profiles.find(p => p.id === profileId);
      if (!profile) throw new Error('Profile not found');

      // Generate a calibration grid
      const calibrationData = {
        id: 'calibration',
        name: `Calibration Grid (${profile.width_mm}×${profile.height_mm}mm)`,
        sku: null,
        barcode: null,
        price: null,
        size: null,
        unit: 'EACH'
      };

      const { data, error } = await supabase.functions.invoke('generate-label', {
        body: {
          template_id: 'calibration-grid',
          data: calibrationData,
          options: {
            width_mm: profile.width_mm,
            height_mm: profile.height_mm,
            dpi: profile.dpi,
            margin_mm: profile.margin_mm
          }
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // Generate PDF from HTML if not provided
      let pdfBase64 = data.pdf_base64;
      if (!pdfBase64 && data.html) {
        pdfBase64 = await htmlToPdfBase64(data.html, {
          width_mm: data.width_mm,
          height_mm: data.height_mm,
          margin_mm: data.margin_mm,
          dpi: data.dpi
        });
      }

      if (pdfBase64) {
        downloadPdf(pdfBase64, 'calibration-grid.pdf');
      }

      toast({
        title: 'Calibration Generated',
        description: 'Download the PDF and print it to verify physical dimensions.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate calibration grid',
        variant: 'destructive',
      });
    }
  });

  // Helper functions
  const getActiveProfile = () => {
    if (!config) return null;
    return config.profiles.find(p => p.id === config.active_profile_id) || null;
  };

  const validateProfile = (profile: Partial<LabelProfile>): string[] => {
    const errors: string[] = [];
    
    if (!profile.id?.trim()) errors.push('Profile ID is required');
    if (!profile.label_name?.trim()) errors.push('Label name is required');
    if (!profile.template_id?.trim()) errors.push('Template ID is required');
    
    if (typeof profile.width_mm === 'number') {
      if (profile.width_mm < 10 || profile.width_mm > 200) {
        errors.push('Width must be between 10 and 200 mm');
      }
    } else {
      errors.push('Width is required');
    }
    
    if (typeof profile.height_mm === 'number') {
      if (profile.height_mm < 10 || profile.height_mm > 200) {
        errors.push('Height must be between 10 and 200 mm');
      }
    } else {
      errors.push('Height is required');
    }
    
    if (profile.dpi && ![203, 300, 600].includes(profile.dpi)) {
      errors.push('DPI must be 203, 300, or 600');
    }
    
    if (typeof profile.margin_mm === 'number') {
      if (profile.margin_mm < 0 || profile.margin_mm > 10) {
        errors.push('Margin must be between 0 and 10 mm');
      }
    }
    
    return errors;
  };

  return {
    // Data
    config,
    isLoading,
    error,
    activeProfile: getActiveProfile(),
    
    // Actions
    updateConfig: updateConfig.mutate,
    generateCalibration: generateCalibration.mutate,
    
    // Loading states
    updateLoading: updateConfig.isPending,
    calibrationLoading: generateCalibration.isPending,
    
    // Utils
    validateProfile,
  };
}