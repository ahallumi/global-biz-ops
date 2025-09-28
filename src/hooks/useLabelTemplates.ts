import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LabelTemplate {
  id: string;
  profile_id: string;
  name: string;
  version: number;
  is_active: boolean;
  template_type?: 'visual' | 'html';
  layout?: any;
  html_template?: string;
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
  template_type?: 'visual' | 'html';
  layout?: any;
  html_template?: string;
  is_active?: boolean;
}

export function useLabelTemplates(profileId?: string) {
  const queryClient = useQueryClient();

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['label-templates', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data, error } = await supabase.functions.invoke('label-templates', {
        body: JSON.stringify({
          action: 'list',
          profile_id: profileId
        })
      });

      if (error) {
        console.error('Error fetching templates:', error);
        throw new Error(error.message || 'Failed to fetch templates');
      }
      return data?.templates || [];
    },
    enabled: !!profileId,
  });

  const upsertTemplate = useMutation({
    mutationFn: async (templateData: UpsertTemplateData) => {
      console.log('Saving template:', templateData);
      
      // Sanitize template data to remove undefined values and ensure it's serializable
      const sanitizedTemplate = {
        ...templateData,
        profile_id: profileId, // Ensure profile_id is always included
        id: templateData.id || undefined, // Clean up undefined id
        template_type: templateData.template_type || 'visual',
        layout: templateData.layout ? JSON.parse(JSON.stringify(templateData.layout)) : null,
        html_template: templateData.html_template || null
      };
      
      const { data, error } = await supabase.functions.invoke('label-templates', {
        body: JSON.stringify({
          action: 'upsert',
          template: sanitizedTemplate
        })
      });

      if (error) {
        console.error('Template save error:', error);
        throw new Error(error.message || error.error || 'Failed to save template');
      }
      
      if (!data?.template) {
        throw new Error('No template returned from server');
      }
      
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Template saved successfully');
    },
    onError: (error: any) => {
      console.error('Error saving template:', error);
      const message = error?.message || error?.error || 'Failed to save template';
      toast.error(`Failed to save template: ${message}`);
    }
  });

  const activateTemplate = useMutation({
    mutationFn: async ({ templateId, profileId }: { templateId: string; profileId: string }) => {
      const { data, error } = await supabase.functions.invoke('label-templates', {
        body: JSON.stringify({
          action: 'activate',
          template_id: templateId,
          profile_id: profileId
        })
      });

      if (error) {
        throw new Error(error.message || error.error || 'Failed to activate template');
      }
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Template activated');
    },
    onError: (error: any) => {
      console.error('Error activating template:', error);
      const message = error?.message || error?.error || 'Failed to activate template';
      toast.error(message);
    }
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.functions.invoke('label-templates', {
        body: JSON.stringify({
          action: 'delete',
          template_id: templateId
        })
      });

      if (error) {
        throw new Error(error.message || error.error || 'Failed to delete template');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Template deleted');
    },
    onError: (error: any) => {
      console.error('Error deleting template:', error);
      const message = error?.message || error?.error || 'Failed to delete template';
      toast.error(message);
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