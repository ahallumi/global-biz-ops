import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LabelDesigner } from '@/components/label-designer/LabelDesigner';
import { useLabelConfig } from '@/hooks/useLabelConfig';
import { Skeleton } from '@/components/ui/skeleton';

export function LabelDesignerPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const { config, isLoading } = useLabelConfig();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="mt-8 space-y-2">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!profileId || !config) {
    navigate('/settings/printing');
    return null;
  }

  const profile = config.profiles?.find(p => p.id === profileId);
  if (!profile) {
    navigate('/settings/printing');
    return null;
  }

  return (
    <LabelDesigner
      profileId={profileId}
      profileName={profile.label_name}
      dimensions={{
        width_mm: profile.width_mm,
        height_mm: profile.height_mm,
        dpi: profile.dpi
      }}
      onBack={() => navigate('/settings/printing')}
    />
  );
}