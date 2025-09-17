import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { formatTime, formatDuration } from '@/lib/timeUtils';
import { format } from 'date-fns';

interface EmployeeTimeTabProps {
  employeeId: string;
}

// Mock data for now - will be replaced with actual hooks later
const mockTimeEntries = [
  {
    id: '1',
    date: '2024-01-15',
    clockIn: '2024-01-15T08:00:00Z',
    clockOut: '2024-01-15T17:30:00Z',
    breakMinutes: 30,
    totalHours: 9.0,
    status: 'completed'
  },
  {
    id: '2',
    date: '2024-01-14',
    clockIn: '2024-01-14T08:15:00Z',
    clockOut: '2024-01-14T17:00:00Z',
    breakMinutes: 45,
    totalHours: 8.25,
    status: 'completed'
  },
  {
    id: '3',
    date: '2024-01-13',
    clockIn: '2024-01-13T08:00:00Z',
    clockOut: null,
    breakMinutes: 0,
    totalHours: 0,
    status: 'open'
  }
];

export function EmployeeTimeTab({ employeeId }: EmployeeTimeTabProps) {
  const [timeEntries] = useState(mockTimeEntries);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      open: 'secondary',
      break: 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const filteredEntries = timeEntries.filter(entry => {
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
    if (selectedDate && entry.date !== format(selectedDate, 'yyyy-MM-dd')) return false;
    return true;
  });

  const totalHours = filteredEntries.reduce((sum, entry) => sum + entry.totalHours, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Time Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{filteredEntries.length}</p>
              <p className="text-sm text-muted-foreground">Total Entries</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {filteredEntries.filter(e => e.status === 'completed').length}
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
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No time entries found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
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