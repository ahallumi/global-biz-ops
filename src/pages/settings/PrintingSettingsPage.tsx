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
import { Switch } from '@/components/ui/switch';
import { useLabelConfig } from '@/hooks/useLabelConfig';
import { useLabelPrint } from '@/hooks/useLabelPrint';
import { Printer, Settings, TestTube, Plus, Edit, Trash2, Monitor, Check, RotateCw, Download, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';
import { convertUnit, formatDimension } from '@/lib/unitConversion';
import { ALLOWED_DPI_VALUES, LabelProfile } from '@/hooks/useLabelConfig';
import { BROTHER_DK_PRESETS, validateBrotherProfile } from "@/lib/paperMatching";
import { PrinterCapabilitiesDisplay } from "@/components/printing/PrinterCapabilitiesDisplay";

// Import the LabelProfile type from the hook

const profileSchema = z.object({
  label_name: z.string().min(1, 'Profile name is required'),
  width_mm: z.number().min(0.1, 'Width must be greater than 0'),
  height_mm: z.number().min(0.1, 'Height must be greater than 0'),
  margin_mm: z.number().min(0, 'Margin must be 0 or greater'),
  dpi: z.number().refine((val) => ALLOWED_DPI_VALUES.includes(val as any), {
    message: `DPI must be one of: ${ALLOWED_DPI_VALUES.join(', ')}`
  }),
  unit: z.enum(['mm', 'inches']),
  orientation: z.enum(['portrait', 'landscape']),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const LABEL_PRESETS = [
  { name: '4" x 6" (Standard)', width_mm: 101.6, height_mm: 152.4, width_in: 4, height_in: 6 },
  { name: '2" x 1" (Small)', width_mm: 50.8, height_mm: 25.4, width_in: 2, height_in: 1 },
  { name: '4" x 3" (Medium)', width_mm: 101.6, height_mm: 76.2, width_in: 4, height_in: 3 },
  { name: '3" x 2" (Compact)', width_mm: 76.2, height_mm: 50.8, width_in: 3, height_in: 2 },
  { name: '2.25" x 1.25" (Address)', width_mm: 57.15, height_mm: 31.75, width_in: 2.25, height_in: 1.25 },
];

export default function PrintingSettingsPage() {
  const { config, activeProfile, updateConfig, generateCalibration, calibrationLoading } = useLabelConfig();
  const { printers } = useLabelPrint();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      label_name: '',
      width_mm: 101.6,
      height_mm: 152.4,
      margin_mm: 2,
      dpi: 300,
      unit: 'mm',
      orientation: 'portrait',
    },
  });

  // Generate template_id based on dimensions and type
  const generateTemplateId = (profile: ProfileFormData): string => {
    const width = Math.round(profile.width_mm);
    const height = Math.round(profile.height_mm);
    const orientation = profile.orientation || 'portrait';
    
    // Create a template ID based on dimensions
    return `custom-${width}x${height}-${orientation}`;
  };

  const handleCreateProfile = (data: ProfileFormData) => {
    const newProfile: LabelProfile = {
      id: Date.now().toString(),
      template_id: generateTemplateId(data),
      label_name: data.label_name,
      width_mm: data.width_mm,
      height_mm: data.height_mm,
      margin_mm: data.margin_mm,
      dpi: data.dpi as typeof ALLOWED_DPI_VALUES[number],
      unit: data.unit,
      orientation: data.orientation,
    };

    console.log('Creating profile:', newProfile);

    const updatedConfig = {
      ...config,
      profiles: [...(config?.profiles || []), newProfile],
    };

    updateConfig(updatedConfig);
    setIsProfileDialogOpen(false);
    form.reset();
  };

  const handleUpdateProfile = (data: ProfileFormData) => {
    if (!editingProfile) return;

    const updatedProfiles = config?.profiles?.map(p => 
      p.id === editingProfile.id ? { 
        ...p, 
        label_name: data.label_name,
        template_id: generateTemplateId(data),
        width_mm: data.width_mm,
        height_mm: data.height_mm,
        margin_mm: data.margin_mm,
        dpi: data.dpi as typeof ALLOWED_DPI_VALUES[number],
        unit: data.unit,
        orientation: data.orientation,
      } : p
    ) || [];

    console.log('Updating profile:', updatedProfiles.find(p => p.id === editingProfile.id));

    const updatedConfig = {
      ...config,
      profiles: updatedProfiles,
    };

    updateConfig(updatedConfig);
    setEditingProfile(null);
    setIsProfileDialogOpen(false);
    form.reset();
  };

  const handleDeleteProfile = (profileId: string) => {
    const updatedProfiles = config?.profiles?.filter(p => p.id !== profileId) || [];
    const updatedConfig = {
      ...config,
      profiles: updatedProfiles,
      active_profile_id: config?.active_profile_id === profileId ? null : config?.active_profile_id,
    };

    updateConfig(updatedConfig);
  };

  const handleSetActiveProfile = (profileId: string) => {
    const updatedConfig = {
      ...config,
      active_profile_id: profileId,
    };

    updateConfig(updatedConfig);
  };

  const openEditDialog = (profile: any) => {
    setEditingProfile(profile);
    form.reset({
      label_name: profile.label_name,
      width_mm: profile.width_mm,
      height_mm: profile.height_mm,
      margin_mm: profile.margin_mm,
      dpi: profile.dpi,
      unit: profile.unit || 'mm',
      orientation: profile.orientation || 'portrait',
    });
    setIsProfileDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProfile(null);
    form.reset();
    setIsProfileDialogOpen(true);
  };

  const applyPreset = (preset: typeof LABEL_PRESETS[0]) => {
    const currentUnit = form.getValues('unit');
    const currentOrientation = form.getValues('orientation');
    
    let width = currentUnit === 'mm' ? preset.width_mm : preset.width_in;
    let height = currentUnit === 'mm' ? preset.height_mm : preset.height_in;
    
    // Swap dimensions if landscape
    if (currentOrientation === 'landscape') {
      [width, height] = [height, width];
    }
    
    form.setValue('width_mm', width);
    form.setValue('height_mm', height);
  };

  const handleUnitChange = (newUnit: 'mm' | 'inches') => {
    const currentUnit = form.getValues('unit');
    if (currentUnit === newUnit) return;

    const currentWidth = form.getValues('width_mm');
    const currentHeight = form.getValues('height_mm');
    const currentMargin = form.getValues('margin_mm');

    const newWidth = convertUnit(currentWidth, currentUnit, newUnit);
    const newHeight = convertUnit(currentHeight, currentUnit, newUnit);
    const newMargin = convertUnit(currentMargin, currentUnit, newUnit);

    form.setValue('unit', newUnit);
    form.setValue('width_mm', newWidth);
    form.setValue('height_mm', newHeight);
    form.setValue('margin_mm', newMargin);
  };

  const handleOrientationToggle = () => {
    const currentOrientation = form.getValues('orientation');
    const newOrientation = currentOrientation === 'portrait' ? 'landscape' : 'portrait';
    
    // Swap width and height
    const currentWidth = form.getValues('width_mm');
    const currentHeight = form.getValues('height_mm');
    
    form.setValue('orientation', newOrientation);
    form.setValue('width_mm', currentHeight);
    form.setValue('height_mm', currentWidth);
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

        {/* Printer Compatibility */}
        <PrinterCapabilitiesDisplay
          printer={printers?.printers?.find(p => p.id === selectedPrinterId) || null}
          profileWidth={activeProfile?.width_mm || 62}
          profileHeight={activeProfile?.height_mm || 29}
        />

        {/* Quick Setup with Brother Presets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Brother DK Quick Setup
            </CardTitle>
            <CardDescription>
              Create profiles for standard Brother DK label rolls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BROTHER_DK_PRESETS.map((preset) => (
                <Card key={preset.name} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                  const newProfile: LabelProfile = {
                    id: Date.now().toString(),
                    label_name: preset.name,
                    width_mm: preset.width_mm,
                    height_mm: preset.height_mm,
                    margin_mm: 2,
                    dpi: 300,
                    unit: 'mm' as const,
                    orientation: preset.width_mm > preset.height_mm ? 'landscape' as const : 'portrait' as const,
                    template_id: `custom-${Math.round(preset.width_mm)}x${Math.round(preset.height_mm)}-${preset.width_mm > preset.height_mm ? 'landscape' : 'portrait'}`
                  };
                  form.reset({
                    label_name: newProfile.label_name,
                    width_mm: newProfile.width_mm,
                    height_mm: newProfile.height_mm,
                    margin_mm: newProfile.margin_mm,
                    dpi: newProfile.dpi,
                    unit: newProfile.unit,
                    orientation: newProfile.orientation,
                  });
                  setEditingProfile(newProfile);
                  setIsProfileDialogOpen(true);
                }}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{preset.name}</h4>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                      <Badge variant="outline">
                        {preset.width_mm}×{preset.height_mm === 0 ? '∞' : preset.height_mm}mm
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                        <span className="font-medium">{profile.label_name}</span>
                        <Badge variant="outline">
                          {formatDimension(profile.width_mm, 'mm')} × {formatDimension(profile.height_mm, 'mm')}
                        </Badge>
                        {config?.active_profile_id === profile.id && (
                          <Badge variant="default">Active</Badge>
                        )}
                        {(() => {
                          const validation = validateBrotherProfile(profile.width_mm, profile.height_mm);
                          return validation.isValid ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {validation.matchedPreset?.name}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-amber-100 text-amber-800">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Custom
                            </Badge>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {formatDimension(profile.width_mm, profile.unit || 'mm')}×{formatDimension(profile.height_mm, profile.unit || 'mm')}
                        </span>
                        <span>•</span>
                        <span>{profile.dpi}dpi</span>
                        <span>•</span>
                        <span>{formatDimension(profile.margin_mm, profile.unit || 'mm')} margin</span>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">
                          {(profile.orientation || 'portrait') === 'portrait' ? '↕' : '↔'} {profile.orientation || 'portrait'}
                        </Badge>
                      </div>
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

        {/* Printer Selection for Testing */}
        <Card>
          <CardHeader>
            <CardTitle>Testing & Calibration</CardTitle>
            <CardDescription>
              Select a printer to test compatibility and print calibration grids
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Printer</label>
                <Select value={selectedPrinterId} onValueChange={setSelectedPrinterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a printer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {printers?.printers?.map(printer => (
                      <SelectItem key={printer.id} value={printer.id}>
                        {printer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeProfile) {
                      generateCalibration(activeProfile.id);
                    }
                  }}
                  disabled={calibrationLoading || !activeProfile}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {calibrationLoading ? 'Generating...' : 'Download Calibration Grid'}
                </Button>
              </div>
            </div>
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
                        <Input placeholder="e.g., Standard 4x6 Label" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quick Presets */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Presets</Label>
                  <div className="flex flex-wrap gap-1">
                    {LABEL_PRESETS.map((preset) => (
                      <Button
                        key={preset.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Units and Orientation Controls */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Units</FormLabel>
                        <Select 
                          value={field.value} 
                          onValueChange={(value) => handleUnitChange(value as 'mm' | 'inches')}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mm">Millimeters (mm)</SelectItem>
                            <SelectItem value="inches">Inches (")</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="orientation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orientation</FormLabel>
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            variant={field.value === 'portrait' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => field.value === 'landscape' && handleOrientationToggle()}
                            className="flex items-center gap-1"
                          >
                            ↕ Portrait
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === 'landscape' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => field.value === 'portrait' && handleOrientationToggle()}
                            className="flex items-center gap-1"
                          >
                            ↔ Landscape
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="width_mm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Width ({form.watch('unit')})
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                        <FormLabel>
                          Height ({form.watch('unit')})
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                        <FormLabel>
                          Margin ({form.watch('unit')})
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Space between content and label edge
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
                        <FormLabel>Print Quality (DPI)</FormLabel>
                        <Select 
                          value={field.value?.toString()} 
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ALLOWED_DPI_VALUES.map((dpi) => (
                              <SelectItem key={dpi} value={dpi.toString()}>
                                {dpi} DPI
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsProfileDialogOpen(false)}
                  >
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