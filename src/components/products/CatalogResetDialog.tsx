import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Trash2, AlertTriangle } from 'lucide-react';
import { useProductCatalogBackup, useProductCatalogReset } from '@/hooks/useProductCatalogReset';
import { useProductsCount } from '@/hooks/useProducts';

interface CatalogResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CatalogResetDialog({ open, onOpenChange }: CatalogResetDialogProps) {
  const [step, setStep] = useState<'confirm' | 'backup' | 'reset'>('confirm');
  const [includeHistory, setIncludeHistory] = useState(false);
  const [backupData, setBackupData] = useState<any>(null);
  
  const { data: productsCount } = useProductsCount('ACTIVE');
  const { data: placeholdersCount } = useProductsCount('PLACEHOLDER');
  const { data: archivedCount } = useProductsCount('ARCHIVED');
  
  const backupMutation = useProductCatalogBackup();
  const resetMutation = useProductCatalogReset();

  const totalProducts = (productsCount || 0) + (placeholdersCount || 0) + (archivedCount || 0);

  const handleBackup = async () => {
    setStep('backup');
    try {
      const result = await backupMutation.mutateAsync();
      setBackupData(result);
      setStep('reset');
    } catch (error) {
      setStep('confirm');
    }
  };

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync({ includeHistory });
      onOpenChange(false);
      // Reset state for next time
      setTimeout(() => {
        setStep('confirm');
        setBackupData(null);
        setIncludeHistory(false);
      }, 100);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const downloadBackup = () => {
    if (!backupData) return;
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-catalog-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset state
    setTimeout(() => {
      setStep('confirm');
      setBackupData(null);
      setIncludeHistory(false);
    }, 100);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reset Product Catalog
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {step === 'confirm' && (
                <>
                  <p>This will permanently delete <strong>ALL</strong> product catalog data:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Badge variant="outline">
                      {totalProducts} Products
                    </Badge>
                    <Badge variant="outline">
                      All POS Links
                    </Badge>
                    <Badge variant="outline">
                      All Candidates
                    </Badge>
                    <Badge variant="outline">
                      All Intakes
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="include-history"
                      checked={includeHistory}
                      onCheckedChange={(checked) => setIncludeHistory(checked === true)}
                    />
                    <label htmlFor="include-history" className="text-xs">
                      Also delete import/sync history
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    A backup will be created first. This action cannot be undone.
                  </p>
                </>
              )}
              
              {step === 'backup' && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating backup before deletion...
                </div>
              )}
              
              {step === 'reset' && backupData && (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <Download className="h-4 w-4" />
                    Backup created ({backupData.summary.total_records} records)
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadBackup}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Backup
                  </Button>
                  <p className="text-xs">
                    Ready to proceed with catalog deletion?
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancel
          </AlertDialogCancel>
          
          {step === 'confirm' && (
            <AlertDialogAction
              onClick={handleBackup}
              disabled={backupMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {backupMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Backup & Reset
            </AlertDialogAction>
          )}
          
          {step === 'reset' && (
            <AlertDialogAction
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {resetMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete All Data
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}