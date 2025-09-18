import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'staff';
  created_at: string;
  last_sign_in_at?: string;
  employee_id?: string;
  employee_name?: string;
  online_access_enabled: boolean;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role?: 'admin' | 'staff';
  employee_id?: string;
}

export interface UpdateUserRequest {
  full_name?: string;
  role?: 'admin' | 'staff';
  employee_id?: string;
}

export interface LinkUserEmployeeRequest {
  user_id: string;
  employee_id: string;
}

// Hook to fetch all users with optional filters
export function useUsers(filters?: { role?: string; search?: string }) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.role) params.append('role', filters.role);
      if (filters?.search) params.append('search', filters.search);

      const { data, error } = await supabase.functions.invoke('users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;
      return data as User[];
    },
  });
}

// Hook to create a new user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: CreateUserRequest) => {
      const { data, error } = await supabase.functions.invoke('users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: userData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('User created successfully');
    },
    onError: (error: any) => {
      console.error('Failed to create user:', error);
      toast.error(`Failed to create user: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to update a user
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, ...userData }: UpdateUserRequest & { userId: string }) => {
      const { data, error } = await supabase.functions.invoke('users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: userData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('User updated successfully');
    },
    onError: (error: any) => {
      console.error('Failed to update user:', error);
      toast.error(`Failed to update user: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to link user to employee
export function useLinkUserEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkData: LinkUserEmployeeRequest) => {
      const { data, error } = await supabase.functions.invoke('users/link-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: linkData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('User linked to employee successfully');
    },
    onError: (error: any) => {
      console.error('Failed to link user to employee:', error);
      toast.error(`Failed to link user to employee: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to delete a user
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke(`users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('User deleted successfully');
    },
    onError: (error: any) => {
      console.error('Failed to delete user:', error);
      toast.error(`Failed to delete user: ${error.message || 'Unknown error'}`);
    },
  });
}