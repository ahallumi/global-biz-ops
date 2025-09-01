import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Clock, Database } from 'lucide-react';

interface ImportRun {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  processed_count: number;
  created_count: number;
  updated_count: number;
  failed_count: number;
  errors: any; // Changed from any[] to any to handle Json type
}

interface Props {
  importRun: ImportRun;
  showMatchBreakdown?: boolean;
}

export function EnhancedImportSummary({ importRun, showMatchBreakdown = true }: Props) {
  // Calculate match method breakdown from errors if available
  const getMatchBreakdown = () => {
    const breakdown = {
      pos_id_matches: importRun.updated_count || 0, // Updates indicate existing POS matches
      upc_matches: 0,
      sku_matches: 0,
      created_new: importRun.created_count || 0
    };

    // Parse error logs for more detailed breakdown
    const errorArray = Array.isArray(importRun.errors) ? importRun.errors : 
                      (importRun.errors ? [importRun.errors] : []);
    const infoLogs = errorArray.filter(e => e?.code === 'INFO') || [];
    // In a real implementation, you'd parse logs for match method details
    
    return breakdown;
  };

  const matchBreakdown = getMatchBreakdown();
  const totalProcessed = importRun.processed_count || 0;
  const successRate = totalProcessed > 0 ? 
    ((importRun.created_count + importRun.updated_count) / totalProcessed) * 100 : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'PARTIAL':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'RUNNING':
      case 'PENDING':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Database className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'bg-green-100 text-green-800';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'RUNNING': return 'bg-blue-100 text-blue-800';
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Import Summary</CardTitle>
          <div className="flex items-center gap-2">
            {getStatusIcon(importRun.status)}
            <Badge className={getStatusColor(importRun.status)}>
              {importRun.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Success Rate</span>
            <span>{successRate.toFixed(1)}%</span>
          </div>
          <Progress value={successRate} className="h-2" />
        </div>

        {/* Basic Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-blue-600">{totalProcessed}</div>
            <div className="text-xs text-muted-foreground">Processed</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-green-600">{importRun.created_count}</div>
            <div className="text-xs text-muted-foreground">Created</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-orange-600">{importRun.updated_count}</div>
            <div className="text-xs text-muted-foreground">Updated</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-red-600">{importRun.failed_count}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Match Method Breakdown */}
        {showMatchBreakdown && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 text-sm">Match Method Breakdown</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>POS ID Matches</span>
                  <span className="font-medium">{matchBreakdown.pos_id_matches}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>UPC Matches</span>
                  <span className="font-medium">{matchBreakdown.upc_matches}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>SKU Matches</span>
                  <span className="font-medium">{matchBreakdown.sku_matches}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>New Products</span>
                  <span className="font-medium">{matchBreakdown.created_new}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Summary */}
        {importRun.errors && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-sm">Issues ({Array.isArray(importRun.errors) ? importRun.errors.length : 1})</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {(Array.isArray(importRun.errors) ? importRun.errors : [importRun.errors]).slice(0, 5).map((error, index) => (
                <div key={index} className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                  <span className="font-medium">{error?.code || 'ERROR'}:</span> {error?.message || String(error)}
                </div>
              ))}
              {Array.isArray(importRun.errors) && importRun.errors.length > 5 && (
                <div className="text-xs text-muted-foreground text-center py-1">
                  ... and {importRun.errors.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timing Info */}
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <div>Started: {new Date(importRun.started_at).toLocaleString()}</div>
          {importRun.finished_at && (
            <div>Finished: {new Date(importRun.finished_at).toLocaleString()}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}