import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock } from "lucide-react";
import { useStationSession } from "@/hooks/useStationSession";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useServerTime } from "@/hooks/useServerTime";
import { useNavigate } from "react-router-dom";

export default function StationClockPage() {
  const { logout } = useStationSession();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccessAction, setIsSuccessAction] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { serverTime } = useServerTime(1000);

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const clearPin = () => {
    setPin("");
  };

  // Auto-logout countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSuccessAction && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (isSuccessAction && countdown === 0) {
      // Auto redirect to station page
      navigate('/station');
    }
    return () => clearTimeout(timer);
  }, [isSuccessAction, countdown, navigate]);

  const startCountdown = () => {
    setIsSuccessAction(true);
    setCountdown(10);
  };

  const handleClockAction = async (action: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END') => {
    if (pin.length !== 4) {
      toast({
        title: "Invalid PIN",
        description: "Please enter a 4-digit PIN",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('station-clock-punch', {
        body: {
          action,
          pin,
        }
      });

      if (error) {
        console.error('Clock punch error:', error);
        let errorMessage = "Network error. Please check your connection and try again.";
        
        if (error.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Connection Error",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      if (!data?.ok) {
        let errorMessage = data?.error || "Failed to process clock action";
        
        // Provide user-friendly error messages
        if (errorMessage === "Invalid PIN") {
          errorMessage = "PIN not recognized. Please check your 4-digit PIN and try again.";
        } else if (errorMessage.includes("already clocked in")) {
          errorMessage = "You are already clocked in. Please clock out first.";
        } else if (errorMessage.includes("No open shift")) {
          errorMessage = "You need to clock in first before performing this action.";
        }
        
        toast({
          title: "Clock Action Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setPin("");
        return;
      }

      // Success case
      toast({
        title: "Success!",
        description: data.message || `${action.replace('_', ' ').toLowerCase()} recorded successfully`,
      });
      setPin("");
      
      // Start auto-logout timer
      startCountdown();
      
    } catch (error) {
      console.error('Clock punch error:', error);
      toast({
        title: "System Error",
        description: "Unable to connect to the time clock system. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/station')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Clock className="h-6 w-6" />
                Time Clock
              </h1>
              <p className="text-sm text-muted-foreground">
                {serverTime ? serverTime.formatted : 'Loading time...'}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        {/* Success Message with Countdown */}
        {isSuccessAction && countdown > 0 && (
          <Card className="mb-6 border-success bg-success/5">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="text-success font-medium">
                  Action completed successfully!
                </div>
                <div className="text-sm text-muted-foreground">
                  Returning to main page in {countdown} seconds...
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/station')}
                  className="mt-2"
                >
                  Return Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {/* PIN Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Enter Your PIN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <Label className="text-lg">4-Digit PIN</Label>
                <div className="flex justify-center gap-2 mt-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-12 h-12 border-2 rounded-lg flex items-center justify-center text-2xl font-mono"
                    >
                      {pin[i] ? '•' : ''}
                    </div>
                  ))}
                </div>
              </div>

              {/* Number Pad */}
              <div className="grid grid-cols-3 gap-3">
                {digits.slice(0, 9).map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="h-12 text-lg"
                    onClick={() => handlePinInput(digit)}
                    disabled={loading || pin.length >= 4}
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={clearPin}
                  disabled={loading}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  className="h-12 text-lg"
                  onClick={() => handlePinInput('0')}
                  disabled={loading || pin.length >= 4}
                >
                  0
                </Button>
                <div></div>
              </div>
            </CardContent>
          </Card>

          {/* Clock Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Clock Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full h-12 text-lg"
                onClick={() => handleClockAction('CLOCK_IN')}
                disabled={loading || pin.length !== 4}
              >
                Clock In
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-12 text-lg"
                onClick={() => handleClockAction('CLOCK_OUT')}
                disabled={loading || pin.length !== 4}
              >
                Clock Out
              </Button>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="h-12"
                  onClick={() => handleClockAction('BREAK_START')}
                  disabled={loading || pin.length !== 4}
                >
                  Start Break
                </Button>
                
                <Button
                  variant="secondary"
                  className="h-12"
                  onClick={() => handleClockAction('BREAK_END')}
                  disabled={loading || pin.length !== 4}
                >
                  End Break
                </Button>
              </div>

              {pin.length !== 4 && (
                <p className="text-sm text-muted-foreground text-center">
                  Enter your 4-digit PIN to enable clock actions
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Enter your 4-digit staff PIN to clock in/out</p>
              <p>• Use "Start Break" when beginning unpaid breaks</p>
              <p>• Use "End Break" when returning from break</p>
              <p>• Clock out at the end of your shift</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}