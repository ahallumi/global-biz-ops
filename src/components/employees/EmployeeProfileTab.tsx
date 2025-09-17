import { useState } from 'react';
import { useUpdateEmployee } from '@/hooks/useEmployees';
import { Employee, UpdateEmployeeRequest } from '@/types/employee';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Edit, Save, X, Key } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EmployeeProfileTabProps {
  employee: Employee;
}

export function EmployeeProfileTab({ employee }: EmployeeProfileTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [formData, setFormData] = useState<UpdateEmployeeRequest>({
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email || '',
    phone: employee.phone || '',
    position: employee.position || '',
    department: employee.department || '',
    pay_type: employee.pay_type,
    hourly_rate: employee.hourly_rate || 0,
    salary_annual: employee.salary_annual || 0,
    status: employee.status,
  });
  const [newPin, setNewPin] = useState('');

  const updateEmployee = useUpdateEmployee();

  const handleSave = () => {
    const updateData: UpdateEmployeeRequest = {
      ...formData,
      ...(isChangingPin && newPin ? { pin_raw: newPin } : {}),
    };

    updateEmployee.mutate(
      { id: employee.id, data: updateData },
      {
        onSuccess: () => {
          setIsEditing(false);
          setIsChangingPin(false);
          setNewPin('');
        },
      }
    );
  };

  const handleCancel = () => {
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email || '',
      phone: employee.phone || '',
      position: employee.position || '',
      department: employee.department || '',
      pay_type: employee.pay_type,
      hourly_rate: employee.hourly_rate || 0,
      salary_annual: employee.salary_annual || 0,
      status: employee.status,
    });
    setIsEditing(false);
    setIsChangingPin(false);
    setNewPin('');
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Basic Information</CardTitle>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="flex items-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateEmployee.isPending}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              {isEditing ? (
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              ) : (
                <p className="text-sm py-2">{employee.first_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              {isEditing ? (
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              ) : (
                <p className="text-sm py-2">{employee.last_name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {isEditing ? (
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              ) : (
                <p className="text-sm py-2">{employee.email || 'Not provided'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              ) : (
                <p className="text-sm py-2">{employee.phone || 'Not provided'}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              {isEditing ? (
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              ) : (
                <p className="text-sm py-2">{employee.position || 'Not specified'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              {isEditing ? (
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              ) : (
                <p className="text-sm py-2">{employee.department || 'Not specified'}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            {isEditing ? (
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'inactive') => 
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="py-2">{getStatusBadge(employee.status)}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pay Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay_type">Pay Type</Label>
            {isEditing ? (
              <Select
                value={formData.pay_type}
                onValueChange={(value: 'hourly' | 'salary') => 
                  setFormData({ ...formData, pay_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm py-2 capitalize">{employee.pay_type}</p>
            )}
          </div>

          {(isEditing ? formData.pay_type : employee.pay_type) === 'hourly' && (
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate</Label>
              {isEditing ? (
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                />
              ) : (
                <p className="text-sm py-2">
                  {employee.hourly_rate ? formatCurrency(employee.hourly_rate) : 'Not set'}
                </p>
              )}
            </div>
          )}

          {(isEditing ? formData.pay_type : employee.pay_type) === 'salary' && (
            <div className="space-y-2">
              <Label htmlFor="salary_annual">Annual Salary</Label>
              {isEditing ? (
                <Input
                  id="salary_annual"
                  type="number"
                  step="1000"
                  value={formData.salary_annual}
                  onChange={(e) => setFormData({ ...formData, salary_annual: parseFloat(e.target.value) || 0 })}
                />
              ) : (
                <p className="text-sm py-2">
                  {employee.salary_annual ? formatCurrency(employee.salary_annual) : 'Not set'}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kiosk Access</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsChangingPin(!isChangingPin)}
            className="flex items-center space-x-2"
          >
            <Key className="h-4 w-4" />
            <span>Change PIN</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>PIN Status</Label>
            <p className="text-sm py-2">
              PIN is configured for kiosk access
            </p>
          </div>

          {isChangingPin && (
            <div className="space-y-2">
              <Label htmlFor="new_pin">New PIN</Label>
              <Input
                id="new_pin"
                type="password"
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <p className="text-xs text-muted-foreground">
                Enter a 4-digit PIN for kiosk access
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hire Date</Label>
              <p className="text-sm py-2">
                {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : 'Not specified'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <p className="text-sm py-2 font-mono">{employee.id}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm py-2">
                {new Date(employee.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-sm py-2">
                {new Date(employee.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}