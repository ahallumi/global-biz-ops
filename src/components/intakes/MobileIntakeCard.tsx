import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IntakeStatusBadge } from './IntakeStatusBadge';
import { Eye, Edit, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

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

interface MobileIntakeCardProps {
  intake: IntakeData;
}

export function MobileIntakeCard({ intake }: MobileIntakeCardProps) {
  const navigate = useNavigate();
  const intakeId = intake.id.split('-')[0].toUpperCase();

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* Header with ID and Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted rounded-md px-2 py-1">
              <span className="font-mono text-sm font-medium">{intakeId}</span>
            </div>
            <IntakeStatusBadge status={intake.status} />
          </div>
        </div>

        {/* Supplier Info */}
        <div className="space-y-1">
          <h3 className="font-medium text-foreground leading-tight">
            {intake.suppliers?.name || 'Unknown Supplier'}
          </h3>
          {intake.suppliers?.code && (
            <p className="text-sm text-muted-foreground">
              Code: {intake.suppliers.code}
            </p>
          )}
        </div>

        {/* Key Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Received</p>
              <p className="font-medium">
                {format(new Date(intake.date_received), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {format(new Date(intake.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
        </div>

        {/* Invoice Number */}
        {intake.invoice_number && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">Invoice Number</p>
            <p className="font-mono text-sm font-medium">{intake.invoice_number}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/intakes/${intake.id}`)}
            className="flex-1"
          >
            <Eye className="mr-2 h-4 w-4" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/intakes/${intake.id}/edit`)}
            className="flex-1"
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}