
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProductCandidates } from '@/hooks/useProductCandidates';
import { useInventoryIntegrations } from '@/hooks/useInventoryIntegrations';
import { usePushProductsToSquare } from '@/hooks/useProductSync';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, ArrowRight, Package, AlertTriangle } from 'lucide-react';
import { CandidateActions } from '../products/CandidateActions';

interface CandidateResolutionStepProps {
  intakeId: string;
  onComplete: () => void;
}

export function CandidateResolutionStep({ intakeId, onComplete }: CandidateResolutionStepProps) {
  const { toast } = useToast();
  const { data: allCandidates = [] } = useProductCandidates();
  const { data: integrations = [] } = useInventoryIntegrations();
  const pushProducts = usePushProductsToSquare();
  
  // Filter candidates for this intake
  const intakeCandidates = allCandidates.filter(
    candidate => candidate.intake_id === intakeId && candidate.status === 'PENDING'
  );
  
  // Use the real auto_push_enabled flag
  const autoPushEnabled = integrations[0]?.auto_push_enabled || false;
  
  const canComplete = intakeCandidates.length === 0;
  
  if (intakeCandidates.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">All Products Resolved</h3>
          <p className="text-muted-foreground">
            All product candidates have been resolved. You can now finalize the intake.
          </p>
        </div>
        
        <div className="flex justify-center">
          <Button onClick={onComplete} size="lg">
            <ArrowRight className="mr-2 h-4 w-4" />
            Complete Intake
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Resolve Product Candidates</h3>
        <p className="text-muted-foreground">
          New products from this intake need to be reviewed before finalizing.
        </p>
      </div>
      
      {autoPushEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Auto-Push Enabled</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Approved products will automatically be pushed to Square.
          </p>
        </div>
      )}
      
      <div className="space-y-4">
        {intakeCandidates.map((candidate) => (
          <Card key={candidate.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{candidate.name}</CardTitle>
                  <CardDescription>
                    UPC: {candidate.upc} • Source: {candidate.source}
                  </CardDescription>
                </div>
                <Badge variant="secondary">{candidate.status}</Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="flex justify-end">
                <CandidateActions
                  candidate={candidate}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="text-center text-sm text-muted-foreground">
        {intakeCandidates.length} product{intakeCandidates.length !== 1 ? 's' : ''} pending resolution
      </div>
    </div>
  );
}
