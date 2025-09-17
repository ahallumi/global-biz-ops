import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from '@/types/employee';
import { useToast } from '@/hooks/use-toast';

export function useEmployees(filters?: {
  status?: string;
  department?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.department) params.append('department', filters.department);
      if (filters?.search) params.append('search', filters.search);

      const { data, error } = await supabase.functions.invoke('employees', {
        method: 'GET',
      });

      if (error) throw error;
      return data.employees as Employee[];
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateEmployeeRequest) => {
      const { data: result, error } = await supabase.functions.invoke('employees', {
        method: 'POST',
        body: data,
      });

      if (error) throw error;
      return result.employee as Employee;
    },
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({
        title: "Employee Created",
        description: `${employee.display_name} has been added successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create employee",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEmployeeRequest }) => {
      const { data: result, error } = await supabase.functions.invoke(`employees/${id}`, {
        method: 'PATCH',
        body: data,
      });

      if (error) throw error;
      return result.employee as Employee;
    },
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
      toast({
        title: "Employee Updated",
        description: `${employee.display_name} has been updated successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke(`employees/${id}`, {
        method: 'DELETE',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({
        title: "Employee Deactivated",
        description: "Employee has been deactivated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate employee",
        variant: "destructive",
      });
    },
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('employees', {
        method: 'GET',
      });

      if (error) throw error;
      const employees = data.employees as Employee[];
      return employees.find(emp => emp.id === id);
    },
    enabled: !!id,
  });
}