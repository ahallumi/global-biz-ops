import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Clock, Info, XCircle, AlertCircle, StopCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "@/hooks/use-toast"
import { getImportStatusLabel, getImportStatusVariant } from "@/lib/importStatusLabels"

interface LiveImportStatusPanelProps {
  importRun: any
  title: string
}

export function LiveImportStatusPanel({ importRun, title }: LiveImportStatusPanelProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [isAborting, setIsAborting] = useState(false)
  
  const getElapsedTime = () => {
    if (!importRun?.started_at) return "0s"
    const elapsed = Math.floor((new Date().getTime() - new Date(importRun.started_at).getTime()) / 1000)
    if (elapsed < 60) return `${elapsed}s`
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}m ${seconds}s`
  }

  const statusConfig = {
    PENDING: { label: getImportStatusLabel('PENDING'), icon: AlertCircle, color: 'text-yellow-500', tone: 'neutral' },
    RUNNING: { label: getImportStatusLabel('RUNNING'), icon: Loader2, color: 'text-blue-500', tone: 'progress' },
    PARTIAL: { label: getImportStatusLabel('PARTIAL'), icon: Loader2, color: 'text-blue-500', tone: 'progress' },
    SUCCESS: { label: getImportStatusLabel('SUCCESS'), icon: CheckCircle2, color: 'text-green-500', tone: 'success' },
    FAILED: { label: getImportStatusLabel('FAILED'), icon: XCircle, color: 'text-red-500', tone: 'error' },
  }

  const status = importRun?.status || 'PENDING'
  const config = statusConfig[status] || statusConfig.PENDING
  const StatusIcon = config.icon

  const getStatusIcon = () => {
    const isAnimated = status === 'RUNNING' || status === 'PARTIAL'
    return <StatusIcon className={`h-4 w-4 ${config.color} ${isAnimated ? 'animate-spin' : ''}`} />
  }

  // Detect no-op runs (completed but did nothing)
  const created = importRun?.created_count ?? 0
  const updated = importRun?.updated_count ?? 0
  const processed = importRun?.processed_count ?? 0
  const isNoOp = (status === 'SUCCESS') && created === 0 && updated === 0 && processed === 0

  const handleAbort = async () => {
    if (!importRun?.id || isAborting) return
    
    setIsAborting(true)
    try {
      const { error } = await supabase.functions.invoke('import-abort', {
        body: { runId: importRun.id }
      })
      
      if (error) {
        throw error
      }
      
      toast({
        title: "Import cancelled",
        description: "The import operation has been cancelled successfully."
      })
    } catch (error) {
      console.error('Failed to abort import:', error)
      toast({
        title: "Failed to cancel import", 
        description: "Could not cancel the import operation.",
        variant: "destructive"
      })
    } finally {
      setIsAborting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <Badge 
          variant={config.tone === 'success' ? 'default' : config.tone === 'error' ? 'destructive' : 'secondary'}
          className={config.tone === 'progress' ? 'animate-pulse' : ''}
        >
          {config.label}
        </Badge>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">
            {isNoOp ? 'No changes needed' : config.label}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Elapsed time</span>
          <span className="font-mono">{getElapsedTime()}</span>
        </div>

        {importRun?.processed_count !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono">
                {importRun.processed_count || 0} processed
              </span>
            </div>
            
            {isNoOp ? (
              <div className="text-sm text-muted-foreground">
                {processed === 0 
                  ? "Importer fetched 0 items from Square. Open Sync Queue for details."
                  : "No new items found or all items were already up to date."
                }
              </div>
            ) : importRun.created_count !== undefined && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-600">
                  ✓ {created} created
                </span>
                <span className="text-blue-600">
                  ↻ {updated} updated
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      <Separator />

      {importRun?.status === 'RUNNING' && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleAbort}
            disabled={isAborting}
            className="flex-1"
          >
            <StopCircle className="h-3 w-3 mr-1" />
            {isAborting ? 'Cancelling...' : 'Cancel Import'}
          </Button>
        </div>
      )}

      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-3 w-3" />
              <span className="text-xs">Import Details</span>
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="text-xs space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Started:</span>
              <span>{importRun?.started_at ? new Date(importRun.started_at).toLocaleTimeString() : 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span>Import from Square</span>
            </div>
            <div className="flex justify-between">
              <span>Trigger:</span>
              <span>Manual</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}