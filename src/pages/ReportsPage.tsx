import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Download, BarChart3, Clock, Users, DollarSign } from 'lucide-react';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(2024, 11, 1),
    to: new Date(2024, 11, 22)
  });

  const reportTypes = [
    {
      id: 'timesheet',
      name: 'Timesheet Report',
      description: 'Employee hours and attendance summary',
      icon: Clock,
      category: 'Time & Attendance'
    },
    {
      id: 'payroll',
      name: 'Payroll Summary',
      description: 'Wages, overtime, and deductions breakdown',
      icon: DollarSign,
      category: 'Payroll'
    },
    {
      id: 'employee',
      name: 'Employee Report',
      description: 'Staff details and performance metrics',
      icon: Users,
      category: 'HR'
    },
    {
      id: 'productivity',
      name: 'Productivity Analysis',
      description: 'Efficiency and output measurements',
      icon: BarChart3,
      category: 'Analytics'
    }
  ];

  const quickReports = [
    {
      title: 'This Week Timesheet',
      description: 'Dec 16 - Dec 22, 2024',
      value: '1,250 hours',
      change: '+5.2% from last week'
    },
    {
      title: 'Monthly Payroll',
      description: 'December 2024',
      value: '$125,430',
      change: '+3.1% from November'
    },
    {
      title: 'Active Employees',
      description: 'Current staff count',
      value: '24 employees',
      change: '+2 new hires this month'
    },
    {
      title: 'Overtime Hours',
      description: 'This pay period',
      value: '87 hours',
      change: '-12% from last period'
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Generate and export detailed reports for time tracking, payroll, and HR analytics
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickReports.map((report, index) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{report.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{report.description}</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{report.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="generate" className="space-y-6">
          <TabsList>
            <TabsTrigger value="generate">Generate Reports</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
            <TabsTrigger value="history">Report History</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-6">
            {/* Date Range Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Report Parameters</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select date range and filters for your reports
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-48 justify-start text-left font-normal",
                              !dateRange.from && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange.from ? (
                              format(dateRange.from, "LLL dd, y")
                            ) : (
                              <span>Pick start date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.from}
                            onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-48 justify-start text-left font-normal",
                              !dateRange.to && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange.to ? (
                              format(dateRange.to, "LLL dd, y")
                            ) : (
                              <span>Pick end date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.to}
                            onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    <Select>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="administration">Administration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Format</label>
                    <Select defaultValue="pdf">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Types */}
            <div className="grid gap-4 md:grid-cols-2">
              {reportTypes.map((report) => (
                <Card key={report.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <report.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{report.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                        {report.category}
                      </div>
                      <Button size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Generate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="scheduled">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Reports</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage automated report generation and delivery
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No scheduled reports configured.</p>
                  <Button className="mt-4" variant="outline">
                    Create Scheduled Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Report History</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View and download previously generated reports
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No reports have been generated yet.</p>
                  <p className="text-sm">Generated reports will appear here for download.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}