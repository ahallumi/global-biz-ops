import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Play, Square, Coffee } from "lucide-react";
import { Link } from "react-router-dom";
import { useServerTime } from "@/hooks/useServerTime";
import { useCurrentShift } from "@/hooks/useCurrentShift";
import { useClockPunch } from "@/hooks/useClockPunch";
import { formatDuration, formatTime, calculateWorkingSeconds } from "@/lib/timeUtils";
import { useState, useEffect } from "react";

export function ClockCard() {
  const { serverTime, loading: timeLoading } = useServerTime(20000); // Update every 20 seconds
  const { data: currentShift, isLoading: shiftLoading } = useCurrentShift();
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
    return <Badge variant={variant}>{status}</Badge>;
  };

  const getClockTime = () => {
    if (!currentShift) return null;
    if (currentShift.break_open_at) {
      return `on break since ${formatTime(currentShift.break_open_at)}`;
    }
    return `since ${formatTime(currentShift.clock_in_at)}`;
  };

  const handlePunch = (action: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END') => {
    punch({ action });
  };

  const isLoading = timeLoading || shiftLoading || isPending;

  if (isLoading && !serverTime) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Clock In/Out
          </CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Clock In/Out
        </CardTitle>
        <CardDescription>
          {serverTime ? (
            <div className="space-y-1">
              <div className="text-lg font-mono">{serverTime.time_only}</div>
              <div className="text-sm text-muted-foreground">Austin, TX (Server Time)</div>
            </div>
          ) : (
            'Loading time...'
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          {getStatusBadge()}
          <div className="text-sm text-muted-foreground">
            {getClockTime()}
          </div>
        </div>

        {currentShift && (
          <div className="space-y-2">
            <div className="text-center">
              <div className="text-2xl font-mono font-bold">{formatDuration(workingTime)}</div>
              <div className="text-sm text-muted-foreground">Hours worked today</div>
            </div>
            
            {currentShift.break_seconds > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Break time: {formatDuration(currentShift.break_seconds)}
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-1 gap-2">
          {!currentShift ? (
            <Button 
              onClick={() => handlePunch('CLOCK_IN')} 
              disabled={isPending}
              className="w-full"
            >
              <Play className="mr-2 h-4 w-4" />
              Clock In
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {!currentShift.break_open_at ? (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => handlePunch('BREAK_START')} 
                    disabled={isPending}
                  >
                    <Coffee className="mr-2 h-4 w-4" />
                    Start Break
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => handlePunch('CLOCK_OUT')} 
                    disabled={isPending}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Clock Out
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => handlePunch('BREAK_END')} 
                    disabled={isPending}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    End Break
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => handlePunch('CLOCK_OUT')} 
                    disabled={isPending}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Clock Out
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link to="/clock">
            <Button variant="outline" size="sm">
              Full Screen Clock
            </Button>
          </Link>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Time is rounded to nearest minute
        </div>
      </CardContent>
    </Card>
  );
}