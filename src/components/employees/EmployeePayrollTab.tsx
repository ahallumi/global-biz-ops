import { useState } from 'react';
import { Employee } from '@/types/employee';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar as CalendarIcon, Download, Calculator, DollarSign } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

interface EmployeePayrollTabProps {
  employee: Employee;
}

// Mock payroll data - will be replaced with actual hook later
const mockPayrollData = {
  currentPeriod: {
    startDate: '2024-01-08',
    endDate: '2024-01-14',
    regularHours: 35.5,
    overtimeHours: 4.5,
    doubletimeHours: 0,
    totalBreakMinutes: 180,
    grossRegular: 710.00,
    grossOvertime: 101.25,
    grossTotal: 811.25,
    entries: [
      {
        date: '2024-01-08',
        clockIn: '08:00',
        clockOut: '17:30',
        hours: 9.0,
        overtimeHours: 1.0,
        breakMinutes: 30
      },
      {
        date: '2024-01-09',
        clockIn: '08:15',
        clockOut: '17:00',
        hours: 8.25,
        overtimeHours: 0.25,
        breakMinutes: 45
      },
      {
        date: '2024-01-10',
        clockIn: '08:00',
        clockOut: '17:00',
        hours: 8.5,
        overtimeHours: 0.5,
        breakMinutes: 30
      },
      {
        date: '2024-01-11',
        clockIn: '08:00',
        clockOut: '17:15',
        hours: 8.75,
        overtimeHours: 0.75,
        breakMinutes: 45
      },
      {
        date: '2024-01-12',
        clockIn: '08:00',
        clockOut: '18:00',
        hours: 9.5,
        overtimeHours: 1.5,
        breakMinutes: 30
      }
    ]
  }
};

export function EmployeePayrollTab({ employee }: EmployeePayrollTabProps) {
  const [selectedStartDate, setSelectedStartDate] = useState<Date>();
  const [selectedEndDate, setSelectedEndDate] = useState<Date>();
  const [payrollData] = useState(mockPayrollData);

  const handleCalculatePayroll = () => {
    // Mock calculation - in real implementation, this would call the payroll calculation API
    console.log('Calculating payroll for date range:', selectedStartDate, selectedEndDate);
  };

  const handleExportPayroll = () => {
    // Mock export - in real implementation, this would generate and download a report
    console.log('Exporting payroll report');
  };

  const setCurrentWeek = () => {
    const now = new Date();
    setSelectedStartDate(startOfWeek(now, { weekStartsOn: 1 }));
    setSelectedEndDate(endOfWeek(now, { weekStartsOn: 1 }));
  };

  const setPreviousWeek = () => {
    const now = new Date();
    const lastWeek = subWeeks(now, 1);
    setSelectedStartDate(startOfWeek(lastWeek, { weekStartsOn: 1 }));
    setSelectedEndDate(endOfWeek(lastWeek, { weekStartsOn: 1 }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payroll Calculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {selectedStartDate ? format(selectedStartDate, 'PPP') : 'Select start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedStartDate}
                    onSelect={setSelectedStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {selectedEndDate ? format(selectedEndDate, 'PPP') : 'Select end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedEndDate}
                    onSelect={setSelectedEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={setCurrentWeek}>
              Current Week
            </Button>
            <Button variant="outline" size="sm" onClick={setPreviousWeek}>
              Previous Week
            </Button>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleCalculatePayroll}
              disabled={!selectedStartDate || !selectedEndDate}
              className="flex items-center space-x-2"
            >
              <Calculator className="h-4 w-4" />
              <span>Calculate Payroll</span>
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPayroll}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Current Period Summary</span>
            <Badge variant="outline">
              {format(new Date(payrollData.currentPeriod.startDate), 'MMM d')} - {' '}
              {format(new Date(payrollData.currentPeriod.endDate), 'MMM d, yyyy')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{payrollData.currentPeriod.regularHours}</p>
              <p className="text-sm text-muted-foreground">Regular Hours</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{payrollData.currentPeriod.overtimeHours}</p>
              <p className="text-sm text-muted-foreground">Overtime Hours</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{Math.round(payrollData.currentPeriod.totalBreakMinutes / 60 * 10) / 10}</p>
              <p className="text-sm text-muted-foreground">Break Hours</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Regular Pay ({payrollData.currentPeriod.regularHours} hrs × {formatCurrency(employee.hourly_rate || 0)}):</span>
              <span className="font-medium">{formatCurrency(payrollData.currentPeriod.grossRegular)}</span>
            </div>
            <div className="flex justify-between">
              <span>Overtime Pay ({payrollData.currentPeriod.overtimeHours} hrs × {formatCurrency((employee.hourly_rate || 0) * 1.5)}):</span>
              <span className="font-medium">{formatCurrency(payrollData.currentPeriod.grossOvertime)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Gross Total:</span>
              <span>{formatCurrency(payrollData.currentPeriod.grossTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payrollData.currentPeriod.entries.map((entry, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium">
                    {format(new Date(entry.date), 'EEEE, MMM d')}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>{entry.clockIn} - {entry.clockOut}</span>
                    <span>Break: {entry.breakMinutes}min</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{entry.hours} hours</p>
                  {entry.overtimeHours > 0 && (
                    <p className="text-sm text-orange-600">+{entry.overtimeHours} OT</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}