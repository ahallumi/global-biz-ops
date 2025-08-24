import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, Clock, Upload, RotateCcw, ExternalLink } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useProductSyncRuns, usePushProductsToSquare, getSyncRunSummary, useActiveSyncRun } from "@/hooks/useProductSync"
import { useProducts } from "@/hooks/useProducts"
import { useToast } from "@/hooks/use-toast"
import { LiveSyncStatusPanel } from "./LiveSyncStatusPanel"

interface SyncStatusPopoverProps {
  onNavigateToSyncQueue?: () => void
  localOnlyCount?: number
}

export function SyncStatusPopover({ onNavigateToSyncQueue, localOnlyCount = 0 }: SyncStatusPopoverProps) {
  const navigate = useNavigate()
  const { data: syncRuns } = useProductSyncRuns()
  const { data: activeSyncRun } = useActiveSyncRun()
  const pushToSquare = usePushProductsToSquare()
  const { toast } = useToast()
  
  const summary = getSyncRunSummary(syncRuns || [])
  
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

  const handlePushAll = () => {
    if (localOnlyCount > 0) {
      // This will trigger a push of all local-only products
      pushToSquare.mutate([])
    } else {
      toast({
        title: 'No Products to Push',
        description: 'There are no local-only products available to push to Square.',
      })
    }
  }

  // Show live status if there's an active sync run
  if (activeSyncRun) {
    return (
      <LiveSyncStatusPanel 
        syncRun={activeSyncRun} 
        title="Push to Square" 
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Push to Square</span>
      </div>
      
      {summary.lastRun ? (
        <>
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Last push</span>
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
          No push operations yet
        </div>
      )}
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Local-only products</span>
          <Badge variant="secondary">{localOnlyCount}</Badge>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handlePushAll}
            disabled={pushToSquare.isPending}
            className="flex-1"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Push All
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => navigate('/sync-queue')}
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}