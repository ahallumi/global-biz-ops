import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Package, Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ImportProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  mode: 'START' | 'RESUME';
}

interface ImportProgress {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  processed_count: number;
  created_count: number;
  updated_count: number;
  started_at: string;
  finished_at?: string;
  errors?: any[];
}

export function ImportProgressDialog({ 
  open, 
  onOpenChange, 
  integrationId,
  mode 
}: ImportProgressDialogProps) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!open) return;

    let subscription: any;
    
    const setupSubscription = () => {
      // Subscribe to real-time updates for import runs
      subscription = supabase
        .channel('import-progress')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'product_import_runs',
            filter: `integration_id=eq.${integrationId}`
          },
          (payload) => {
            console.log('Import progress update:', payload);
            if (payload.new) {
              const newData = payload.new as ImportProgress;
              setProgress(newData);
              
              if (newData.status === 'COMPLETED' || newData.status === 'FAILED') {
                setIsCompleted(true);
              }
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [open, integrationId]);

  const getProgressPercentage = () => {
    if (!progress) return 0;
    if (progress.status === 'COMPLETED') return 100;
    if (progress.status === 'FAILED') return 0;
    if (progress.status === 'PENDING') return 0;
    
    // For running status, we'll estimate based on processed count
    // Since we don't know total count ahead of time, we'll show indeterminate progress
    return progress.processed_count > 0 ? 50 : 10;
  };

  const getStatusIcon = () => {
    if (!progress) return <Loader2 className="h-4 w-4 animate-spin" />;
    
    switch (progress.status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (!progress) return 'Initializing import...';
    
    switch (progress.status) {
      case 'PENDING':
        return 'Import queued and waiting to start...';
      case 'RUNNING':
        return `Processing products... (${progress.processed_count} processed)`;
      case 'COMPLETED':
        return 'Import completed successfully!';
      case 'FAILED':
        return 'Import failed. Please check the errors below.';
      default:
        return 'Unknown status';
    }
  };

  const formatDuration = () => {
    if (!progress?.started_at) return null;
    
    const start = new Date(progress.started_at);
    const end = progress.finished_at ? new Date(progress.finished_at) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importing from Square ({mode})
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <div className="font-medium text-sm">{getStatusText()}</div>
              {formatDuration() && (
                <div className="text-xs text-muted-foreground">
                  Duration: {formatDuration()}
                </div>
              )}
            </div>
            <Badge variant={
              progress?.status === 'COMPLETED' ? 'default' :
              progress?.status === 'FAILED' ? 'destructive' :
              progress?.status === 'RUNNING' ? 'secondary' :
              'outline'
            }>
              {progress?.status || 'INITIALIZING'}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress 
              value={getProgressPercentage()} 
              className="h-2"
            />
            {progress && progress.status === 'RUNNING' && (
              <div className="text-xs text-muted-foreground text-center">
                {progress.processed_count > 0 
                  ? `${progress.processed_count} products processed so far...`
                  : 'Fetching products from Square...'
                }
              </div>
            )}
          </div>

          {/* Results Summary */}
          {progress && (progress.status === 'COMPLETED' || progress.status === 'FAILED') && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{progress.processed_count}</div>
                  <div className="text-xs text-muted-foreground">Processed</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-green-600">{progress.created_count}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-blue-600">{progress.updated_count}</div>
                  <div className="text-xs text-muted-foreground">Updated</div>
                </div>
              </div>
              
              {progress.errors && progress.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                    <AlertCircle className="h-4 w-4" />
                    {progress.errors.length} Error(s) Occurred
                  </div>
                  <div className="text-xs text-muted-foreground max-h-20 overflow-y-auto">
                    {progress.errors.slice(0, 3).map((error, index) => (
                      <div key={index} className="mb-1">
                        {typeof error === 'string' ? error : JSON.stringify(error)}
                      </div>
                    ))}
                    {progress.errors.length > 3 && (
                      <div className="text-muted-foreground">
                        ... and {progress.errors.length - 3} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            {isCompleted ? (
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Run in Background
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}