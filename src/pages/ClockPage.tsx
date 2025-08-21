import { useServerTime } from "@/hooks/useServerTime";
import { useCurrentShift } from "@/hooks/useCurrentShift";
import { useClockPunch } from "@/hooks/useClockPunch";
import { useTodaysSummary } from "@/hooks/useTodaysSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Square, Coffee, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDuration, formatTime, calculateWorkingSeconds } from "@/lib/timeUtils";
import { useState, useEffect } from "react";

export default function ClockPage() {
  const { serverTime, loading: timeLoading } = useServerTime(10000); // Update every 10 seconds
  const { data: currentShift, isLoading: shiftLoading } = useCurrentShift();
  const { data: summary } = useTodaysSummary();
  const { punch, isPending } = useClockPunch();
  const [workingTime, setWorkingTime] = useState<number>(0);

  // Update working time every second when clocked in
  useEffect(() => {
    if (!currentShift) {
      setWorkingTime(0);
      return;
    }

    const updateWorkingTime = () => {
      const seconds = calculateWorkingSeconds(
        currentShift.clock_in_at,
        currentShift.clock_out_at,
        currentShift.break_seconds || 0,
        currentShift.break_open_at
      );
      setWorkingTime(seconds);
    };

    // Update immediately
    updateWorkingTime();

    // Update every second
    const interval = setInterval(updateWorkingTime, 1000);
    return () => clearInterval(interval);
  }, [currentShift]);

  const getStatus = () => {
    if (!currentShift) return 'Not clocked in';
    if (currentShift.break_open_at) return 'On break';
    return 'On shift';
  };

  const getStatusBadge = () => {
    const status = getStatus();
    const variant = status === 'On shift' ? 'default' : status === 'On break' ? 'secondary' : 'outline';
    return <Badge variant={variant} className="text-lg px-4 py-2">{status}</Badge>;
  };

  const handlePunch = (action: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END') => {
    punch({ action });
  };

  const isLoading = timeLoading || shiftLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <Link to="/staff-dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Time Clock</h1>
        <div className="w-24" /> {/* Spacer for centering */}
      </div>

      {/* Main Clock Interface */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 space-y-8">
            {/* Server Time Display */}
            <div className="text-center space-y-2">
              {serverTime && (
                <>
                  <div className="text-6xl font-mono font-bold tracking-tight">
                    {serverTime.time_only}
                  </div>
                  <div className="text-xl text-muted-foreground">
                    {new Date().toLocaleDateString('en-US', {
                      timeZone: 'America/Chicago',
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="text-sm text-muted-foreground">Austin, TX (Server Time)</div>
                </>
              )}
              {!serverTime && isLoading && (
                <div className="text-4xl font-mono">Loading...</div>
              )}
            </div>

            {/* Status and Working Time */}
            <div className="text-center space-y-4">
              {getStatusBadge()}
              
              {currentShift && (
                <div className="space-y-2">
                  <div className="text-4xl font-mono font-bold">{formatDuration(workingTime)}</div>
                  <div className="text-muted-foreground">Hours worked today</div>
                  
                  {currentShift.clock_in_at && (
                    <div className="text-sm text-muted-foreground">
                      Clocked in at {formatTime(currentShift.clock_in_at)}
                    </div>
                  )}
                  
                  {currentShift.break_open_at && (
                    <div className="text-sm text-muted-foreground">
                      Break started at {formatTime(currentShift.break_open_at)}
                    </div>
                  )}
                  
                  {currentShift.break_seconds > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Total break time: {formatDuration(currentShift.break_seconds)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              {!currentShift ? (
                <Button 
                  onClick={() => handlePunch('CLOCK_IN')} 
                  disabled={isPending}
                  className="w-full h-16 text-xl"
                  size="lg"
                >
                  <Play className="mr-3 h-6 w-6" />
                  Clock In
                </Button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!currentShift.break_open_at ? (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handlePunch('BREAK_START')} 
                        disabled={isPending}
                        className="h-16 text-lg"
                        size="lg"
                      >
                        <Coffee className="mr-3 h-5 w-5" />
                        Start Break
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handlePunch('CLOCK_OUT')} 
                        disabled={isPending}
                        className="h-16 text-lg"
                        size="lg"
                      >
                        <Square className="mr-3 h-5 w-5" />
                        Clock Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        onClick={() => handlePunch('BREAK_END')} 
                        disabled={isPending}
                        className="h-16 text-lg"
                        size="lg"
                      >
                        <Play className="mr-3 h-5 w-5" />
                        End Break
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handlePunch('CLOCK_OUT')} 
                        disabled={isPending}
                        className="h-16 text-lg"
                        size="lg"
                      >
                        <Square className="mr-3 h-5 w-5" />
                        Clock Out
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            {summary?.punchEvents && summary.punchEvents.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </h3>
                <div className="space-y-2">
                  {summary.punchEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-center justify-between py-2 px-4 bg-muted/50 rounded-lg">
                      <span className="font-medium">
                        {event.kind.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTime(event.event_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Info */}
            <div className="text-center text-sm text-muted-foreground border-t pt-6">
              Time is automatically rounded to the nearest minute
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}