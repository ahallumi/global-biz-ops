import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';

type IntakeStatus = Database['public']['Enums']['intake_status'];

interface IntakeStatusBadgeProps {
  status: IntakeStatus;
}

export function IntakeStatusBadge({ status }: IntakeStatusBadgeProps) {
  const getStatusVariant = (status: IntakeStatus) => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'submitted':
        return 'outline';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'needs_correction':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusColor = (status: IntakeStatus) => {
    switch (status) {
      case 'draft':
        return 'text-muted-foreground';
      case 'submitted':
        return 'text-warning';
      case 'approved':
        return 'text-success';
      case 'rejected':
        return 'text-destructive';
      case 'needs_correction':
        return 'text-warning';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatStatus = (status: IntakeStatus) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <Badge 
      variant={getStatusVariant(status)}
      className={getStatusColor(status)}
    >
      {formatStatus(status)}
    </Badge>
  );
}