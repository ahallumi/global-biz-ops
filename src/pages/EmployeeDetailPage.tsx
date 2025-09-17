import { useParams } from 'react-router-dom';
import { useEmployee } from '@/hooks/useEmployees';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeeProfileTab } from '@/components/employees/EmployeeProfileTab';
import { EmployeeFilesTab } from '@/components/employees/EmployeeFilesTab';
import { EmployeeTimeTab } from '@/components/employees/EmployeeTimeTab';
import { EmployeePayrollTab } from '@/components/employees/EmployeePayrollTab';
import { User, Clock, FileText, DollarSign } from 'lucide-react';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: employee, isLoading, error } = useEmployee(id || '');

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  if (error || !employee) {
    return (
      <Layout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Employee not found.</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Employee Details</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="" />
                <AvatarFallback className="text-lg">
                  {getInitials(employee.first_name, employee.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-2xl">{employee.display_name}</CardTitle>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <span>{employee.email}</span>
                  <span>{employee.position}</span>
                  <span>{employee.department}</span>
                  {getStatusBadge(employee.status)}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Files</span>
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Time</span>
            </TabsTrigger>
            <TabsTrigger value="payroll" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Payroll</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <EmployeeProfileTab employee={employee} />
          </TabsContent>

          <TabsContent value="files">
            <EmployeeFilesTab employeeId={employee.id} />
          </TabsContent>

          <TabsContent value="time">
            <EmployeeTimeTab employeeId={employee.id} />
          </TabsContent>

          <TabsContent value="payroll">
            <EmployeePayrollTab employee={employee} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}