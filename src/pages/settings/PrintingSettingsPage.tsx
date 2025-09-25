import { useState } from 'react';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLabelConfig } from '@/hooks/useLabelConfig';
import { Printer, Settings, TestTube, Plus, Edit, Trash2, Monitor, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';

// Import the LabelProfile type from the hook
interface LabelProfile {
  id: string;
  label_name: string;
  template_id: string;
  width_mm: number;
  height_mm: number;
  dpi: number;
  margin_mm: number;
}

const profileSchema = z.object({
  label_name: z.string().min(1, 'Profile name is required'),
  width_mm: z.number().min(1, 'Width must be greater than 0'),
  height_mm: z.number().min(1, 'Height must be greater than 0'),
  margin_mm: z.number().min(0, 'Margin must be 0 or greater'),
  dpi: z.number().min(72, 'DPI must be at least 72'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const LABEL_PRESETS = [
  { name: '4" x 6" (Standard)', width: 101.6, height: 152.4 },
  { name: '2" x 1" (Small)', width: 50.8, height: 25.4 },
  { name: '4" x 3" (Medium)', width: 101.6, height: 76.2 },
  { name: '3" x 2" (Compact)', width: 76.2, height: 50.8 },
  { name: '2.25" x 1.25" (Address)', width: 57.15, height: 31.75 },
];

export default function PrintingSettingsPage() {
  const { config, activeProfile, updateConfig, generateCalibration, calibrationLoading } = useLabelConfig();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      label_name: '',
      width_mm: 101.6,
      height_mm: 152.4,
      margin_mm: 2,
      dpi: 300,
    },
  });

  const handleCreateProfile = (data: ProfileFormData) => {
    const newProfile: LabelProfile = {
      id: Date.now().toString(),
      template_id: 'standard',
      label_name: data.label_name,
      width_mm: data.width_mm,
      height_mm: data.height_mm,
      margin_mm: data.margin_mm,
      dpi: data.dpi,
    };

    const updatedConfig = {
      ...config,
      profiles: [...(config?.profiles || []), newProfile],
    };

    updateConfig(updatedConfig, {
      onSuccess: () => {
        toast({ title: 'Profile created successfully' });
        setIsProfileDialogOpen(false);
        form.reset();
      },
    });
  };

  const handleUpdateProfile = (data: ProfileFormData) => {
    if (!editingProfile) return;

    const updatedProfiles = config?.profiles?.map(p => 
      p.id === editingProfile.id ? { 
        ...p, 
        label_name: data.label_name,
        width_mm: data.width_mm,
        height_mm: data.height_mm,
        margin_mm: data.margin_mm,
        dpi: data.dpi,
      } : p
    ) || [];

    const updatedConfig = {
      ...config,
      profiles: updatedProfiles,
    };

    updateConfig(updatedConfig, {
      onSuccess: () => {
        toast({ title: 'Profile updated successfully' });
        setEditingProfile(null);
        setIsProfileDialogOpen(false);
        form.reset();
      },
    });
  };

  const handleDeleteProfile = (profileId: string) => {
    const updatedProfiles = config?.profiles?.filter(p => p.id !== profileId) || [];
    const updatedConfig = {
      ...config,
      profiles: updatedProfiles,
      active_profile_id: config?.active_profile_id === profileId ? null : config?.active_profile_id,
    };

    updateConfig(updatedConfig, {
      onSuccess: () => {
        toast({ title: 'Profile deleted successfully' });
      },
    });
  };

  const handleSetActiveProfile = (profileId: string) => {
    const updatedConfig = {
      ...config,
      active_profile_id: profileId,
    };

    updateConfig(updatedConfig, {
      onSuccess: () => {
        toast({ title: 'Active profile updated' });
      },
    });
  };

  const openEditDialog = (profile: any) => {
    setEditingProfile(profile);
    form.reset({
      label_name: profile.label_name,
      width_mm: profile.width_mm,
      height_mm: profile.height_mm,
      margin_mm: profile.margin_mm,
      dpi: profile.dpi,
    });
    setIsProfileDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProfile(null);
    form.reset();
    setIsProfileDialogOpen(true);
  };

  const applyPreset = (preset: typeof LABEL_PRESETS[0]) => {
    form.setValue('width_mm', preset.width);
    form.setValue('height_mm', preset.height);
  };

  return (
    <SettingsLayout
      title="Printing Settings"
      description="Configure label printing profiles and settings"
    >
      <div className="space-y-6">
        {/* Current Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Current Configuration
            </CardTitle>
            <CardDescription>
              Active label printing configuration and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Active Profile</h4>
                {activeProfile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{activeProfile.label_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {activeProfile.width_mm}×{activeProfile.height_mm}mm @ {activeProfile.dpi}dpi
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active profile</p>
                )}
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Available Profiles</h4>
                <p className="text-sm text-muted-foreground">
                  {config?.profiles?.length || 0} profiles configured
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => activeProfile && generateCalibration(activeProfile.id)}
                disabled={!activeProfile || calibrationLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <TestTube className="h-4 w-4" />
                {calibrationLoading ? 'Generating...' : 'Test Calibration'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Label Profiles Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Label Profiles
                </CardTitle>
                <CardDescription>
                  Create and manage label printing profiles with different dimensions
                </CardDescription>
              </div>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Profile
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {config?.profiles?.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{profile.label_name}</h4>
                        {activeProfile?.id === profile.id && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {profile.width_mm}×{profile.height_mm}mm • {profile.dpi}dpi • {profile.margin_mm}mm margin
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {activeProfile?.id !== profile.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActiveProfile(profile.id)}
                      >
                        Set Active
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(profile)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteProfile(profile.id)}
                      disabled={activeProfile?.id === profile.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {(!config?.profiles || config.profiles.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No label profiles configured</p>
                  <p className="text-sm">Create your first profile to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Station Overrides */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Station Overrides
            </CardTitle>
            <CardDescription>
              Configure station-specific printing settings (coming soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Station-specific printer and profile overrides will be available in the next update.
            </p>
          </CardContent>
        </Card>

        {/* Profile Dialog */}
        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? 'Edit Profile' : 'Create New Profile'}
              </DialogTitle>
              <DialogDescription>
                Configure the dimensions and settings for this label profile.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(editingProfile ? handleUpdateProfile : handleCreateProfile)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 4x6 Standard Labels" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <Label>Quick Presets</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {LABEL_PRESETS.map((preset) => (
                      <Button
                        key={preset.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className="text-xs"
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="width_mm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Width (mm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="height_mm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (mm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="margin_mm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Margin (mm)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Space around label content
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dpi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DPI</FormLabel>
                        <FormControl>
                          <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="150">150 DPI</SelectItem>
                              <SelectItem value="200">200 DPI</SelectItem>
                              <SelectItem value="300">300 DPI (Recommended)</SelectItem>
                              <SelectItem value="600">600 DPI</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          Higher DPI = better quality, larger files
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsProfileDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingProfile ? 'Update Profile' : 'Create Profile'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsLayout>
  );
}