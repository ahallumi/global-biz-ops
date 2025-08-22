import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type ProductCandidate = Database['public']['Tables']['product_candidates']['Row'];

interface IntakeCandidateCardProps {
  candidates: ProductCandidate[];
  onResolve: () => void;
}

export function IntakeCandidateCard({ candidates, onResolve }: IntakeCandidateCardProps) {
  const pendingCount = candidates.filter(c => c.status === 'PENDING').length;
  
  if (candidates.length === 0) return null;
  
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {pendingCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          Product Candidates
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingCount} pending
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {pendingCount > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-800">
              This intake contains {pendingCount} new product{pendingCount !== 1 ? 's' : ''} that need{pendingCount === 1 ? 's' : ''} approval before entering your catalog.
            </p>
            <button
              onClick={onResolve}
              className="text-sm font-medium text-amber-700 hover:text-amber-900 underline"
            >
              Review candidates →
            </button>
          </div>
        ) : (
          <p className="text-sm text-green-800">
            All product candidates have been resolved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}