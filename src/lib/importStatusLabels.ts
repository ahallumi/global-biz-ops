
// Import status label mappings for UI display
export const importStatusLabels: Record<string, string> = {
  NONE: 'Idle',
  PENDING: 'Queued',
  RUNNING: 'Importing…',
  PARTIAL: 'Continuing…',
  SUCCESS: 'Done',
  FAILED: 'Failed',
};

export const getImportStatusLabel = (status: string | null | undefined): string => {
  if (!status) return importStatusLabels.NONE;
  return importStatusLabels[status] || status;
};

export const getImportStatusVariant = (status: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (!status) return 'outline';
  
  switch (status) {
    case 'SUCCESS':
      return 'default';
    case 'RUNNING':
    case 'PARTIAL':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    case 'PENDING':
      return 'outline';
    default:
      return 'outline';
  }
};
