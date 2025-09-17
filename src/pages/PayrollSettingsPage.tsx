import React, { useState } from 'react';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePayrollSettings, useUpdatePayrollSettings } from '@/hooks/usePayrollSettings';
import { Loader2 } from 'lucide-react';

export default function PayrollSettingsPage() {
  const { data: settings, isLoading } = usePayrollSettings();
  const updateSettings = useUpdatePayrollSettings();
  
  const [formData, setFormData] = useState({
    pay_period: settings?.pay_period || 'weekly',
    payroll_day: settings?.payroll_day || 5,
    overtime_daily: settings?.overtime_daily || 8,
    overtime_weekly: settings?.overtime_weekly || 40,
    rounding_minutes: settings?.rounding_minutes || 1,
    timezone: settings?.timezone || 'America/Chicago'
  });

  // Update form data when settings load
  React.useEffect(() => {
    if (settings) {
      setFormData({
        pay_period: settings.pay_period,
        payroll_day: settings.payroll_day,
        overtime_daily: settings.overtime_daily,
        overtime_weekly: settings.overtime_weekly,
        rounding_minutes: settings.rounding_minutes,
        timezone: settings.timezone
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(formData);
  };

  if (isLoading) {
    return (
      <SettingsLayout title="Payroll Settings" description="Configure payroll calculation rules and schedules">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout 
      title="Payroll Settings" 
      description="Configure payroll calculation rules and schedules"
    >
      <div className="space-y-6">
        {/* Pay Period Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Pay Period Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pay_period">Pay Period</Label>
                <Select 
                  value={formData.pay_period} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, pay_period: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payroll_day">Payroll Day (Day of Week)</Label>
                <Select 
                  value={formData.payroll_day.toString()} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, payroll_day: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                    <SelectItem value="0">Sunday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
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
                <Label htmlFor="overtime_daily">Daily Overtime Threshold (hours)</Label>
                <Input
                  id="overtime_daily"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={formData.overtime_daily}
                  onChange={(e) => setFormData(prev => ({ ...prev, overtime_daily: parseFloat(e.target.value) }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="overtime_weekly">Weekly Overtime Threshold (hours)</Label>
                <Input
                  id="overtime_weekly"
                  type="number"
                  step="0.5"
                  min="0"
                  max="168"
                  value={formData.overtime_weekly}
                  onChange={(e) => setFormData(prev => ({ ...prev, overtime_weekly: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Rounding Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Time Tracking Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rounding_minutes">Time Rounding (minutes)</Label>
              <Select 
                value={formData.rounding_minutes.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, rounding_minutes: parseInt(value) }))}
              >
                <SelectTrigger className="w-full md:w-48">
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
              <p className="text-sm text-muted-foreground">
                Time entries will be rounded to the nearest {formData.rounding_minutes} minute(s)
              </p>
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