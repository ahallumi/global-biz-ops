import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCreateUser, useUpdateUser, User } from '@/hooks/useUsers';
import { useEmployees } from '@/hooks/useEmployees';
import { toast } from 'sonner';

const userSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  full_name: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'staff']).optional(),
  employee_id: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onClose: () => void;
}

export function UserDialog({ open, onOpenChange, user, onClose }: UserDialogProps) {
  const [activeTab, setActiveTab] = useState('new-user');
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { data: employees } = useEmployees();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      role: 'staff',
      employee_id: undefined,
    },
  });

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      if (user) {
        // Editing existing user
        form.reset({
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          employee_id: user.employee_id || undefined,
        });
        setActiveTab('edit-user');
      } else {
        // Creating new user
        form.reset({
          email: '',
          password: '',
          full_name: '',
          role: 'staff',
          employee_id: undefined,
        });
        setActiveTab('new-user');
      }
    }
  }, [open, user, form]);

  const onSubmit = async (data: UserFormData) => {
    try {
      if (user) {
        // Update existing user
        await updateUser.mutateAsync({
          userId: user.id,
          full_name: data.full_name,
          role: data.role,
          employee_id: data.employee_id,
        });
      } else {
        // Create new user
        if (activeTab === 'from-employee' && !data.employee_id) {
          toast.error('Please select an employee to create user account for.');
          return;
        }

        if (activeTab === 'new-user' && !data.password) {
          toast.error('Password is required for new users.');
          return;
        }

        await createUser.mutateAsync({
          email: data.email,
          password: data.password!,
          full_name: data.full_name,
          role: data.role,
          employee_id: activeTab === 'from-employee' ? data.employee_id : undefined,
        });
      }

      onClose();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const availableEmployees = employees?.filter(emp => 
    emp.status === 'active' && !emp.online_access_enabled
  ) || [];

  const selectedEmployee = employees?.find(emp => emp.id === form.watch('employee_id'));

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees?.find(emp => emp.id === employeeId);
    if (employee) {
      form.setValue('employee_id', employeeId);
      form.setValue('full_name', employee.display_name || `${employee.first_name} ${employee.last_name}`);
      form.setValue('email', employee.email || '');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {user ? 'Edit User' : 'Add User'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {!user && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new-user">Create New User</TabsTrigger>
                <TabsTrigger value="from-employee">Add From Employee</TabsTrigger>
              </TabsList>

              <TabsContent value="new-user" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...form.register('email')}
                      placeholder="user@example.com"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      {...form.register('password')}
                      placeholder="Enter password"
                    />
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    {...form.register('full_name')}
                    placeholder="John Doe"
                  />
                  {form.formState.errors.full_name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={form.watch('role')}
                    onValueChange={(value: 'admin' | 'staff') => form.setValue('role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="from-employee" className="space-y-4">
                {availableEmployees.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label>Select Employee</Label>
                      <Select
                        value={form.watch('employee_id') || ''}
                        onValueChange={handleEmployeeSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEmployees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{employee.display_name || `${employee.first_name} ${employee.last_name}`}</span>
                                <Badge variant="outline" className="ml-2">
                                  {employee.department || 'No Dept'}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedEmployee && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Employee Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Name:</span> {selectedEmployee.display_name}
                            </div>
                            <div>
                              <span className="font-medium">Email:</span> {selectedEmployee.email || 'Not set'}
                            </div>
                            <div>
                              <span className="font-medium">Position:</span> {selectedEmployee.position || 'Not set'}
                            </div>
                            <div>
                              <span className="font-medium">Department:</span> {selectedEmployee.department || 'Not set'}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          {...form.register('password')}
                          placeholder="Enter password"
                        />
                        {form.formState.errors.password && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={form.watch('role')}
                          onValueChange={(value: 'admin' | 'staff') => form.setValue('role', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-muted-foreground">
                        <p>No employees available for user account creation.</p>
                        <p className="text-sm mt-2">
                          All employees either already have user accounts or are inactive.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}

          {user && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed after account creation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  {...form.register('full_name')}
                  placeholder="John Doe"
                />
                {form.formState.errors.full_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.full_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(value: 'admin' | 'staff') => form.setValue('role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createUser.isPending || updateUser.isPending}
            >
              {user ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}