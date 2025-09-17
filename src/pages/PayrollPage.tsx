import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, DollarSign, Users, Clock, FileText, Download } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { formatCurrency } from '@/lib/utils';

export default function PayrollPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const { data: employees = [] } = useEmployees();
  
  // Mock payroll data - replace with actual hook
  const payrollSummary = {
    totalEmployees: employees.length,
    totalHours: 1250.5,
    regularHours: 1050.5,
    overtimeHours: 200.0,
    totalPayroll: 31265.50,
    payPeriod: 'Dec 16 - Dec 22, 2024'
  };

  const payrollEntries = employees.map(emp => ({
    id: emp.id,
    name: emp.display_name || `${emp.first_name} ${emp.last_name}`,
    department: emp.department || 'General',
    regularHours: Math.floor(Math.random() * 40) + 30,
    overtimeHours: Math.floor(Math.random() * 10),
    hourlyRate: emp.hourly_rate || 15.00,
    grossPay: 0,
    status: 'pending'
  })).map(entry => ({
    ...entry,
    grossPay: (entry.regularHours * entry.hourlyRate) + (entry.overtimeHours * entry.hourlyRate * 1.5)
  }));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
            <p className="text-muted-foreground">
              Manage payroll calculations and employee compensation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Period</SelectItem>
                <SelectItem value="previous">Previous Period</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Export Payroll
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payrollSummary.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Active employees</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payrollSummary.totalHours}</div>
              <p className="text-xs text-muted-foreground">
                {payrollSummary.regularHours} regular + {payrollSummary.overtimeHours} overtime
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(payrollSummary.totalPayroll)}</div>
              <p className="text-xs text-muted-foreground">For {payrollSummary.payPeriod}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pay Period</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Weekly</div>
              <p className="text-xs text-muted-foreground">{payrollSummary.payPeriod}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payroll Entries */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Payroll Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review and calculate payroll for the current pay period
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payrollEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{entry.name}</h4>
                    <p className="text-sm text-muted-foreground">{entry.department}</p>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-medium">{entry.regularHours}h</div>
                      <div className="text-muted-foreground">Regular</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="font-medium">{entry.overtimeHours}h</div>
                      <div className="text-muted-foreground">Overtime</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="font-medium">{formatCurrency(entry.hourlyRate)}/hr</div>
                      <div className="text-muted-foreground">Rate</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="font-medium">{formatCurrency(entry.grossPay)}</div>
                      <div className="text-muted-foreground">Gross Pay</div>
                    </div>
                    
                    <Badge variant={entry.status === 'pending' ? 'secondary' : 'default'}>
                      {entry.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                {payrollEntries.length} employees • Total: {formatCurrency(payrollEntries.reduce((sum, e) => sum + e.grossPay, 0))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
                <Button>Process Payroll</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}