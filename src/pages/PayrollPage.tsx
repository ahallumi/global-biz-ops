import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Calendar, DollarSign, Users, Clock, FileText, Download } from 'lucide-react';
import { usePayrollCalculation } from '@/hooks/usePayrollCalculation';
import { formatCurrency } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { addDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

export default function PayrollPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  
  // Calculate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'current':
        return {
          startDate: startOfWeek(now),
          endDate: endOfWeek(now)
        };
      case 'previous':
        const prevWeekStart = startOfWeek(subWeeks(now, 1));
        return {
          startDate: prevWeekStart,
          endDate: endOfWeek(prevWeekStart)
        };
      case 'custom':
        return {
          startDate: customDateRange?.from,
          endDate: customDateRange?.to
        };
      default:
        return {
          startDate: startOfWeek(now),
          endDate: endOfWeek(now)
        };
    }
  };

  const { startDate, endDate } = getDateRange();
  const { data: payrollData, isLoading } = usePayrollCalculation({
    startDate,
    endDate
  });

  const handleExportPayroll = () => {
    // TODO: Implement payroll export functionality
    console.log('Exporting payroll data...');
  };

  const handleProcessPayroll = () => {
    // TODO: Implement payroll processing functionality
    console.log('Processing payroll...');
  };

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
              
              {selectedPeriod === 'custom' && (
                <DateRangePicker
                  date={customDateRange}
                  onDateChange={setCustomDateRange}
                  placeholder="Select date range"
                />
              )}
            </div>
            
            <Button onClick={handleExportPayroll}>
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
              <div className="text-2xl font-bold">{payrollData?.summary.totalEmployees || 0}</div>
              <p className="text-xs text-muted-foreground">Active employees</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payrollData?.summary.totalHours.toFixed(1) || 0}</div>
              <p className="text-xs text-muted-foreground">
                {payrollData?.summary.regularHours.toFixed(1) || 0} regular + {payrollData?.summary.overtimeHours.toFixed(1) || 0} overtime
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(payrollData?.summary.totalPayroll || 0)}</div>
              <p className="text-xs text-muted-foreground">For {payrollData?.summary.payPeriod || 'Current Period'}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pay Period</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Weekly</div>
              <p className="text-xs text-muted-foreground">{payrollData?.summary.payPeriod || 'Current Period'}</p>
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
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="text-muted-foreground">Loading payroll data...</div>
                </div>
              </div>
            ) : payrollData?.entries.length ? (
              <div className="space-y-4">
                {payrollData.entries.map((entry) => (
                  <div key={entry.employeeId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{entry.employeeName}</h4>
                      <p className="text-sm text-muted-foreground">{entry.department}</p>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{entry.regularHours.toFixed(1)}h</div>
                        <div className="text-muted-foreground">Regular</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="font-medium">{entry.overtimeHours.toFixed(1)}h</div>
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
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No payroll data found for the selected period
              </div>
            )}
            
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                {payrollData?.entries.length || 0} employees • Total: {formatCurrency(payrollData?.summary.totalPayroll || 0)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportPayroll}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
                <Button onClick={handleProcessPayroll}>Process Payroll</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}