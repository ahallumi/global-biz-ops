import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { CheckCircle, XCircle, Clock, Download, RotateCcw, ExternalLink } from "lucide-react"
import { useProductImportRuns, usePullProductsFromSquare, getImportRunSummary } from "@/hooks/useProductSync"
import { useInventoryIntegrations, useUpdateInventoryIntegration } from "@/hooks/useInventoryIntegrations"

interface ImportStatusPopoverProps {
  onNavigateToSyncQueue?: () => void
}

export function ImportStatusPopover({ onNavigateToSyncQueue }: ImportStatusPopoverProps) {
  const { data: importRuns } = useProductImportRuns()
  const { data: integrations } = useInventoryIntegrations()
  const updateIntegration = useUpdateInventoryIntegration()
  const pullFromSquare = usePullProductsFromSquare()
  
  const summary = getImportRunSummary(importRuns || [])
  const activeIntegration = integrations?.find(i => i.provider === 'SQUARE')
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PENDING':
      case 'RUNNING':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Import from Square</span>
      </div>
      
      {summary.lastRun ? (
        <>
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Last import</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(summary.lastRun.status)}
                <Badge variant={summary.lastRun.status === 'SUCCESS' ? 'default' : 
                               summary.lastRun.status === 'FAILED' ? 'destructive' : 'secondary'}>
                  {summary.lastRun.status}
                </Badge>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {summary.timeAgo}
            </div>
            
            {summary.lastRun.status === 'SUCCESS' && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-600">
                  ✓ {summary.lastRun.created_count || 0} created
                </span>
                <span className="text-blue-600">
                  ↻ {summary.lastRun.updated_count || 0} updated
                </span>
                {(summary.lastRun.processed_count || 0) - (summary.lastRun.created_count || 0) - (summary.lastRun.updated_count || 0) > 0 && (
                  <span className="text-red-600">
                    ✗ {(summary.lastRun.processed_count || 0) - (summary.lastRun.created_count || 0) - (summary.lastRun.updated_count || 0)} failed
                  </span>
                )}
              </div>
            )}
          </Card>
          
          <Separator />
        </>
      ) : (
        <div className="text-sm text-muted-foreground text-center py-2">
          No import operations yet
        </div>
      )}
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Auto-import</div>
            <div className="text-xs text-muted-foreground">Automatically sync from Square</div>
          </div>
          <Switch 
            checked={activeIntegration?.auto_import_enabled || false}
            onCheckedChange={(checked) => {
              if (activeIntegration) {
                updateIntegration.mutate({
                  id: activeIntegration.id,
                  auto_import_enabled: checked
                })
              }
            }}
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => pullFromSquare.mutate()}
            disabled={pullFromSquare.isPending}
            className="flex-1"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Import Now
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onNavigateToSyncQueue}
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}