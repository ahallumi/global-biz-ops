import { AlertTriangle } from 'lucide-react';
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

interface DuplicateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  existingUnitsPerBox: number;
  newUnitsPerBox: number;
  onKeepSeparate: () => void;
  onReplace: () => void;
}

export function DuplicateProductDialog({
  open,
  onOpenChange,
  productName,
  existingUnitsPerBox,
  newUnitsPerBox,
  onKeepSeparate,
  onReplace,
}: DuplicateProductDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <AlertDialogTitle>Duplicate Product Detected</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p>
              <strong>{productName}</strong> already exists in this intake with different packaging:
            </p>
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <div>• Existing: <strong>{existingUnitsPerBox}</strong> units per box</div>
              <div>• New entry: <strong>{newUnitsPerBox}</strong> units per box</div>
            </div>
            <p className="text-sm">
              Would you like to keep them as separate entries or replace the previous one?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepSeparate}>
            Keep Separate
          </AlertDialogCancel>
          <AlertDialogAction onClick={onReplace}>
            Replace Previous
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}