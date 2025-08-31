
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { CheckCircle, XCircle, Clock, Download, RotateCcw, ExternalLink, AlertTriangle, RefreshCw } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useProductImportRuns, getImportRunSummary, useActiveImportRun, useRunningImportRun } from "@/hooks/useProductSync"
import { useInventoryIntegrations, useUpdateInventoryIntegration, useImportProducts } from "@/hooks/useInventoryIntegrations"
import { useImportWatchdog } from "@/hooks/useImportWatchdog"
import { LiveImportStatusPanel } from "./LiveImportStatusPanel"
import { getImportStatusLabel } from "@/lib/importStatusLabels"
import { useQueryClient } from "@tanstack/react-query"

interface ImportStatusPopoverProps {
  onNavigateToSyncQueue?: () => void
}

export function ImportStatusPopover({ onNavigateToSyncQueue }: ImportStatusPopoverProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: importRuns, refetch: refetchImportRuns } = useProductImportRuns()
  const { data: integrations } = useInventoryIntegrations()
  const { data: activeImportRun, refetch: refetchActiveImport } = useActiveImportRun()
  const { data: runningImportRun } = useRunningImportRun()
  const updateIntegration = useUpdateInventoryIntegration()
  const importProducts = useImportProducts()
  const watchdog = useImportWatchdog()
  
  const summary = getImportRunSummary(importRuns || [])
  const activeIntegration = integrations?.find(i => i.provider === 'SQUARE')
  
  const handleManualRefresh = async () => {
    // Force refresh all import-related queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['product-import-runs'] }),
      queryClient.invalidateQueries({ queryKey: ['active-import-run'] }),
      queryClient.invalidateQueries({ queryKey: ['running-import-run'] }),
      refetchImportRuns(),
      refetchActiveImport()
    ])
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PENDING':
      case 'RUNNING':
      case 'PARTIAL':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  // Show live status if there's an active import run
  if (activeImportRun) {
    return (
      <LiveImportStatusPanel 
        importRun={activeImportRun} 
        title="Import from Square" 
      />
    )
  }

  // Check if there's a stale run that needs clearing
  const hasStaleRun = summary.lastRun?.status === 'PARTIAL' && 
    summary.lastRun.processed_count === 0 &&
    new Date().getTime() - new Date(summary.lastRun.started_at).getTime() > 30 * 60 * 1000; // 30 minutes

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Import from Square</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleManualRefresh}
          className="h-6 w-6 p-0"
          title="Refresh status"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
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
                  {getImportStatusLabel(summary.lastRun.status)}
                </Badge>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {summary.timeAgo}
            </div>
            
            {/* Show stale run warning */}
            {hasStaleRun && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border">
                <AlertTriangle className="h-3 w-3" />
                <span>Stale import detected (0 processed). Use "Unstick" to clear it.</span>
              </div>
            )}
            
            {/* Show error if failed */}
            {summary.lastRun.status === 'FAILED' && activeIntegration?.last_error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border">
                {activeIntegration.last_error}
              </div>
            )}
            
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
            onClick={() => {
              if (activeIntegration) {
                importProducts.mutate({ 
                  integrationId: activeIntegration.id, 
                  mode: 'START' 
                })
              }
            }}
            disabled={importProducts.isPending || !activeIntegration || !!runningImportRun}
            className="flex-1"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Import Now
          </Button>
          
          {/* Unstick button - show if there are potentially stale runs */}
          {(hasStaleRun || summary.lastRun?.status === 'PARTIAL') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => watchdog.mutate()}
              disabled={watchdog.isPending}
              title="Clear stale import runs"
            >
              <AlertTriangle className="h-3 w-3" />
            </Button>
          )}
          
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
