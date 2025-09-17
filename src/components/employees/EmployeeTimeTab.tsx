import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar as CalendarIcon, Filter, AlertCircle } from 'lucide-react';
import { formatTime, formatDuration } from '@/lib/timeUtils';
import { format } from 'date-fns';
import { useEmployeeTimeEntries } from '@/hooks/useEmployeeTimeEntries';

interface EmployeeTimeTabProps {
  employeeId: string;
}

export function EmployeeTimeTab({ employeeId }: EmployeeTimeTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { 
    data: timeEntries = [], 
    isLoading, 
    error 
  } = useEmployeeTimeEntries({
    employeeId,
    dateFilter: selectedDate,
    statusFilter
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      open: 'secondary',
      break: 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const totalHours = timeEntries.reduce((sum, entry) => sum + entry.totalHours, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Time Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="text-center space-y-2">
                  <Skeleton className="h-8 w-12 mx-auto" />
                  <Skeleton className="h-4 w-20 mx-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Time Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-muted-foreground">Error loading time entries</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Time Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{timeEntries.length}</p>
              <p className="text-sm text-muted-foreground">Total Entries</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {timeEntries.filter(e => e.status === 'completed').length}
              </p>
              <p className="text-sm text-muted-foreground">Completed Shifts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Time Entries</CardTitle>
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Filter Date</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
                <div className="p-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(undefined)}
                    className="w-full"
                  >
                    Clear Filter
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="break">On Break</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No time entries found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {timeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-4">
                      <p className="font-medium">
                        {new Date(entry.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                      {getStatusBadge(entry.status)}
                    </div>
                    <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                      <span>
                        In: {formatTime(entry.clockIn)}
                      </span>
                      {entry.clockOut && (
                        <span>
                          Out: {formatTime(entry.clockOut)}
                        </span>
                      )}
                      {entry.breakMinutes > 0 && (
                        <span>
                          Break: {formatDuration(entry.breakMinutes * 60)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {entry.totalHours > 0 
                        ? `${entry.totalHours.toFixed(2)} hours`
                        : 'In Progress'
                      }
                    </p>
                    {entry.totalHours > 8 && (
                      <p className="text-xs text-orange-600">
                        {(entry.totalHours - 8).toFixed(2)} hours overtime
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}