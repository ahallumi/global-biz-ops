import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/DataTable';
import { supplierColumns } from '@/components/suppliers/supplierColumns';
import { SupplierDialog } from '@/components/suppliers/SupplierDialog';
import { useSuppliers } from '@/hooks/useSuppliers';
import { Plus, Truck } from 'lucide-react';

export default function SuppliersPage() {
  const { employee } = useAuth();
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (!employee) return null;

  const canCreate = employee.role === 'admin' || employee.role === 'manager';

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Truck className="w-8 h-8 text-primary" />
              Suppliers
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage supplier information and contacts
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Supplier
            </Button>
          )}
        </div>

        {/* Suppliers Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Suppliers</CardTitle>
            <CardDescription>
              View and manage supplier information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={supplierColumns}
              data={suppliers}
              searchKey="name"
              searchPlaceholder="Search suppliers..."
            />
          </CardContent>
        </Card>

        {/* Create Supplier Dialog */}
        <SupplierDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
        />
      </div>
    </Layout>
  );
}