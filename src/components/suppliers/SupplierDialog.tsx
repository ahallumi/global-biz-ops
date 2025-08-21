import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Database } from '@/integrations/supabase/types';
import { SupplierForm } from './SupplierForm';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface SupplierDialogProps {
  open: boolean;
  onClose: () => void;
  supplier?: Supplier;
}

export function SupplierDialog({ open, onClose, supplier }: SupplierDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </DialogTitle>
          <DialogDescription>
            {supplier ? 'Update supplier information and contacts' : 'Enter the supplier details below'}
          </DialogDescription>
        </DialogHeader>
        
        <SupplierForm supplier={supplier} onSuccess={onClose} />
      </DialogContent>
    </Dialog>
  );
}