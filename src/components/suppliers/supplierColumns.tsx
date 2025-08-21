import { ColumnDef } from '@tanstack/react-table';
import { Database } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { MoreHorizontal, Edit, Eye, Package, Trash } from 'lucide-react';
import { useState } from 'react';
import { SupplierDialog } from './SupplierDialog';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteSupplier } from '@/hooks/useSuppliers';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export const supplierColumns: ColumnDef<Supplier>[] = [
  {
    accessorKey: 'code',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
    cell: ({ row }) => (
      <div className="font-mono font-medium">
        {row.getValue('code')}
      </div>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">
        {row.getValue('name')}
      </div>
    ),
  },
  {
    accessorKey: 'contact_name',
    header: 'Contact',
    cell: ({ row }) => {
      const contactName = row.getValue('contact_name') as string;
      const contactEmail = row.original.contact_email;
      const contactPhone = row.original.contact_phone;
      
      return (
        <div>
          {contactName && <div className="font-medium">{contactName}</div>}
          {contactEmail && <div className="text-sm text-muted-foreground">{contactEmail}</div>}
          {contactPhone && <div className="text-sm text-muted-foreground">{contactPhone}</div>}
        </div>
      );
    },
  },
  {
    accessorKey: 'terms',
    header: 'Terms',
    cell: ({ row }) => {
      const terms = row.getValue('terms') as string;
      return (
        <Badge variant="outline">
          {terms.replace('_', ' ')}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => {
      const active = row.getValue('active') as boolean;
      return (
        <Badge variant={active ? 'default' : 'secondary'}>
          {active ? 'Active' : 'Inactive'}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const supplier = row.original;
      const [showEditDialog, setShowEditDialog] = useState(false);
      const [showDeleteDialog, setShowDeleteDialog] = useState(false);
      const { employee } = useAuth();
      const deleteSupplier = useDeleteSupplier();
      
      const canEdit = employee?.role === 'admin' || employee?.role === 'manager';
      const canDelete = employee?.role === 'admin';

      const handleDelete = () => {
        deleteSupplier.mutate(supplier.id);
        setShowDeleteDialog(false);
      };

      return (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Supplier
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Package className="mr-2 h-4 w-4" />
                Create Intake
              </DropdownMenuItem>
              {canDelete && (
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Supplier
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <SupplierDialog
            open={showEditDialog}
            onClose={() => setShowEditDialog(false)}
            supplier={supplier}
          />

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete supplier "{supplier.name}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteSupplier.isPending}
                >
                  {deleteSupplier.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    },
  },
];