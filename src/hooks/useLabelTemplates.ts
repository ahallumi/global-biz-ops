import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LabelTemplate {
  id: string;
  profile_id: string;
  name: string;
  version: number;
  is_active: boolean;
  layout: any;
  preview_png?: string;
  created_by?: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

interface UpsertTemplateData {
  id?: string;
  profile_id: string;
  name: string;
  layout: any;
  is_active?: boolean;
}

export function useLabelTemplates(profileId?: string) {
  const queryClient = useQueryClient();

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['label-templates', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data, error } = await supabase.functions.invoke('label-templates', {
        method: 'GET',
        body: null,
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (error) throw error;
      return data.templates as LabelTemplate[];
    },
    enabled: !!profileId,
  });

  const upsertTemplate = useMutation({
    mutationFn: async (templateData: UpsertTemplateData) => {
      const { data, error } = await supabase.functions.invoke('label-templates', {
        body: {
          action: 'upsert',
          template: templateData
        }
      });

      if (error) throw error;
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Template saved successfully');
    },
    onError: (error: any) => {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  });

  const activateTemplate = useMutation({
    mutationFn: async ({ templateId, profileId }: { templateId: string; profileId: string }) => {
      const { data, error } = await supabase.functions.invoke('label-templates', {
        body: {
          action: 'activate',
          template_id: templateId,
          profile_id: profileId
        }
      });

      if (error) throw error;
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Template activated');
    },
    onError: (error: any) => {
      console.error('Error activating template:', error);
      toast.error('Failed to activate template');
    }
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('label-templates', {
        body: {
          action: 'delete',
          template_id: templateId
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Template deleted');
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  });

  return {
    templates: templates || [],
    isLoading,
    error,
    upsertTemplate,
    activateTemplate,
    deleteTemplate,
  };
}