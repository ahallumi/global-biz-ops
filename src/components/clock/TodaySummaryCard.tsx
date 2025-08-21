import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Coffee } from "lucide-react";
import { useTodaysSummary } from "@/hooks/useTodaysSummary";
import { formatDuration, formatTime } from "@/lib/timeUtils";

export function TodaySummaryCard() {
  const { data: summary, isLoading } = useTodaysSummary();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Today at a Glance
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getPunchKindLabel = (kind: string) => {
    switch (kind) {
      case 'CLOCK_IN': return 'Clocked In';
      case 'CLOCK_OUT': return 'Clocked Out';
      case 'BREAK_START': return 'Break Started';
      case 'BREAK_END': return 'Break Ended';
      default: return kind;
    }
  };

  const getPunchKindColor = (kind: string) => {
    switch (kind) {
      case 'CLOCK_IN': return 'bg-green-100 text-green-800 border-green-200';
      case 'CLOCK_OUT': return 'bg-red-100 text-red-800 border-red-200';
      case 'BREAK_START': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'BREAK_END': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Today at a Glance
        </CardTitle>
        <CardDescription>
          {new Date().toLocaleDateString('en-US', {
            timeZone: 'America/Chicago',
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold">{formatDuration(summary?.totalSeconds || 0)}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Total
            </div>
          </div>
          <div>
            <div className="text-lg font-bold">{formatDuration(summary?.breakSeconds || 0)}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Coffee className="h-3 w-3" />
              Breaks
            </div>
          </div>
          <div>
            <div className="text-lg font-bold">{formatDuration(summary?.netSeconds || 0)}</div>
            <div className="text-sm text-muted-foreground">Net Hours</div>
          </div>
        </div>

        {summary?.punchEvents && summary.punchEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Activity</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {summary.punchEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center justify-between text-sm">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getPunchKindColor(event.kind)}`}
                  >
                    {getPunchKindLabel(event.kind)}
                  </Badge>
                  <span className="text-muted-foreground">
                    {formatTime(event.event_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!summary?.punchEvents || summary.punchEvents.length === 0) && (
          <div className="text-center text-sm text-muted-foreground py-4">
            No activity recorded today
          </div>
        )}
      </CardContent>
    </Card>
  );
}