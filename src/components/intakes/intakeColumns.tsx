import { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Edit } from 'lucide-react';
import { IntakeStatusBadge } from './IntakeStatusBadge';
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type IntakeData = {
  id: string;
  date_received: string;
  invoice_number: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'needs_correction';
  created_at: string;
  suppliers: {
    name: string;
    code: string;
  } | null;
  submitted_by: string;
  supplier_id: string;
  updated_at: string | null;
  invoice_url: string | null;
  location_id: string | null;
  notes: string | null;
};

export const intakeColumns: ColumnDef<IntakeData>[] = [
  {
    id: 'intake_id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Intake ID" />
    ),
    cell: ({ row }) => {
      return (
        <div className="font-mono text-sm">
          {row.original.id.split('-')[0].toUpperCase()}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'suppliers.name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Supplier" />
    ),
    cell: ({ row }) => {
      const supplier = row.original.suppliers;
      return supplier ? (
        <div>
          <div className="font-medium">{supplier.name}</div>
          <div className="text-xs text-muted-foreground">{supplier.code}</div>
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <IntakeStatusBadge status={row.getValue('status')} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'date_received',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date Received" />
    ),
    cell: ({ row }) => {
      return format(new Date(row.getValue('date_received')), 'MMM dd, yyyy');
    },
  },
  {
    accessorKey: 'invoice_number',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoice #" />
    ),
    cell: ({ row }) => {
      const invoiceNumber = row.getValue('invoice_number') as string | null;
      return invoiceNumber ? (
        <span className="font-mono text-sm">{invoiceNumber}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: 'submitted_by',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submitted By" />
    ),
    cell: ({ row }) => {
      return <span className="text-muted-foreground">Staff User</span>;
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      return format(new Date(row.getValue('created_at')), 'MMM dd, yyyy');
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const navigate = useNavigate();
      const intake = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/intakes/${intake.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/intakes/${intake.id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Intake
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];