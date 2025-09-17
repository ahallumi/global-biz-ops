import React, { useState } from 'react';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useServerTime } from '@/hooks/useServerTime';
import { Clock, Loader2, RefreshCw } from 'lucide-react';

interface TimeSettings {
  id: number;
  rounding_minutes: number;
  auto_clock_out_hours: number;
  overtime_daily_hours: number;
  overtime_weekly_hours: number;
  timezone: string;
  default_break_kind: string;
}

export default function TimeSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { serverTime, loading: serverTimeLoading, refetch: refetchServerTime } = useServerTime(5000);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['time-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_settings')
        .select('*')
        .single();

      if (error) throw error;
      return data as TimeSettings;
    },
  });

  const [formData, setFormData] = useState<Partial<TimeSettings>>({
    rounding_minutes: 1,
    auto_clock_out_hours: 12,
    overtime_daily_hours: 8,
    overtime_weekly_hours: 40,
    timezone: 'America/Chicago',
    default_break_kind: 'UNPAID'
  });

  // Update form data when settings load
  React.useEffect(() => {
    if (settings) {
      setFormData({
        rounding_minutes: settings.rounding_minutes,
        auto_clock_out_hours: settings.auto_clock_out_hours,
        overtime_daily_hours: settings.overtime_daily_hours,
        overtime_weekly_hours: settings.overtime_weekly_hours,
        timezone: settings.timezone,
        default_break_kind: settings.default_break_kind
      });
    }
  }, [settings]);

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<TimeSettings>) => {
      const { data, error } = await supabase
        .from('time_settings')
        .update(newSettings)
        .eq('id', 1)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-settings'] });
      refetchServerTime();
      toast({
        title: 'Success',
        description: 'Time settings updated successfully',
      });
    },
    onError: (error) => {
      console.error('Error updating time settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update time settings',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateSettings.mutate(formData);
  };

  if (isLoading) {
    return (
      <SettingsLayout title="Time Settings" description="Configure time tracking and clock settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout 
      title="Time Settings" 
      description="Configure time tracking, timezone, and clock settings"
    >
      <div className="space-y-6">
        {/* Current Time Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Server Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serverTimeLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">Loading server time...</span>
                </div>
              ) : serverTime ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-mono font-bold">{serverTime.formatted}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refetchServerTime}
                      className="gap-2"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Timezone: {serverTime.timezone}
                    </Badge>
                    <Badge variant="outline">
                      UTC: {new Date(serverTime.utc).toLocaleTimeString()}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">Unable to load server time</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timezone Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Timezone Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">System Timezone</Label>
              <Select 
                value={formData.timezone} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Chicago">Central Time (America/Chicago)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (America/New_York)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (America/Denver)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</SelectItem>
                  <SelectItem value="America/Phoenix">Arizona Time (America/Phoenix)</SelectItem>
                  <SelectItem value="America/Alaska">Alaska Time (America/Alaska)</SelectItem>
                  <SelectItem value="Pacific/Honolulu">Hawaii Time (Pacific/Honolulu)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                All employee time tracking will use this timezone
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Time Tracking Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Time Tracking Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rounding_minutes">Time Rounding (minutes)</Label>
                <Select 
                  value={formData.rounding_minutes?.toString()} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, rounding_minutes: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto_clock_out_hours">Auto Clock-Out (hours)</Label>
                <Input
                  id="auto_clock_out_hours"
                  type="number"
                  min="1"
                  max="24"
                  value={formData.auto_clock_out_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto_clock_out_hours: parseInt(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  Automatically clock out employees after this many hours
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_break_kind">Default Break Type</Label>
              <Select 
                value={formData.default_break_kind} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_break_kind: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Paid Break</SelectItem>
                  <SelectItem value="UNPAID">Unpaid Break</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Overtime Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Overtime Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overtime_daily_hours">Daily Overtime Threshold</Label>
                <Input
                  id="overtime_daily_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={formData.overtime_daily_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, overtime_daily_hours: parseFloat(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  Hours per day before overtime rates apply
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overtime_weekly_hours">Weekly Overtime Threshold</Label>
                <Input
                  id="overtime_weekly_hours"
                  type="number"
                  step="0.5"
                  min="0"
                  max="168"
                  value={formData.overtime_weekly_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, overtime_weekly_hours: parseFloat(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  Hours per week before overtime rates apply
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}