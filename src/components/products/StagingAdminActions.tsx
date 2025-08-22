import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlaceholderCleanup } from '@/hooks/usePlaceholderCleanup';
import { useAuth } from '@/hooks/useAuth';
import { Settings, RefreshCw, ArrowRight } from 'lucide-react';

export function StagingAdminActions() {
  const { user, employee } = useAuth();
  const { markAsPlaceholder, convertPlaceholdersToCandidates } = usePlaceholderCleanup();

  // Only show for admins
  if (!employee || employee.role !== 'admin') {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Settings className="h-5 w-5" />
          Admin Actions
        </CardTitle>
        <CardDescription>
          Data cleanup and migration utilities for staging area management.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => markAsPlaceholder.mutate()}
            disabled={markAsPlaceholder.isPending}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${markAsPlaceholder.isPending ? 'animate-spin' : ''}`} />
            Mark Obvious Placeholders
          </Button>
          
          <Button
            onClick={() => convertPlaceholdersToCandidates.mutate()}
            disabled={convertPlaceholdersToCandidates.isPending}
            variant="outline"
            size="sm"
          >
            <ArrowRight className={`h-4 w-4 mr-2 ${convertPlaceholdersToCandidates.isPending ? 'animate-spin' : ''}`} />
            Convert Eligible to Candidates
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p><strong>Mark Obvious Placeholders:</strong> Identifies products with missing price/cost data and marks them as placeholders.</p>
          <p><strong>Convert to Candidates:</strong> Converts placeholders only referenced by draft intakes into candidates for proper workflow.</p>
        </div>
      </CardContent>
    </Card>
  );
}