import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployeeForm } from '@/components/employees/EmployeeForm';
import { useCreateEmployee } from '@/hooks/useEmployees';
import { CreateEmployeeRequest } from '@/types/employee';

export default function NewEmployeePage() {
  const navigate = useNavigate();
  const createEmployee = useCreateEmployee();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: CreateEmployeeRequest) => {
    setIsSubmitting(true);
    try {
      const employee = await createEmployee.mutateAsync(data);
      navigate(`/employees/${employee.id}`);
    } catch (error) {
      // Error handling is done in the mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Employees
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Add New Employee</h1>
            <p className="text-muted-foreground">
              Create a new employee profile with basic information and access settings
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeForm
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              submitText="Create Employee"
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}