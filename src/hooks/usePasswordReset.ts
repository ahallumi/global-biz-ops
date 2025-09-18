import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PasswordResetRequest {
  email: string;
  user_id: string;
}

export function usePasswordReset() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, user_id }: PasswordResetRequest) => {
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email, user_id }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send password reset email');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Password reset sent',
        description: `Password reset email has been sent to ${variables.email}`,
      });
      
      // Optionally invalidate users query to refresh any related data
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to send password reset',
        description: error.message,
      });
    },
  });
}