import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { supabase } from "@/integrations/supabase/client"
import { ChevronDown, ChevronUp, Clock, XCircle, CheckCircle, Loader, X, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface LiveImportStatusPanelProps {
  importRun: any
  title: string
}

export function LiveImportStatusPanel({ importRun, title }: LiveImportStatusPanelProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [isAborting, setIsAborting] = useState(false)
  const [isUnsticking, setIsUnsticking] = useState(false)
  const [lastProcessedCount, setLastProcessedCount] = useState(importRun.processed_count || 0)
  const [noProgressSince, setNoProgressSince] = useState<Date | null>(null)

  // Track progress stagnation and auto-trigger watchdog
  useEffect(() => {
    if (importRun.status !== 'RUNNING') return

    const currentProcessed = importRun.processed_count || 0
    
    if (currentProcessed === lastProcessedCount) {
      // No progress - start timer if not already started
      if (!noProgressSince) {
        setNoProgressSince(new Date())
      } else {
        // Check if we've been stuck for too long
        const elapsedMs = Date.now() - noProgressSince.getTime()
        const elapsedMinutes = Math.floor(elapsedMs / 60000)
        
        // Auto-trigger watchdog after 15+ minutes with no progress
        if (elapsedMinutes >= 15) {
          const totalElapsedMs = Date.now() - new Date(importRun.started_at).getTime()
          const totalElapsedMinutes = Math.floor(totalElapsedMs / 60000)
          
          if (totalElapsedMinutes >= 15) {
            console.log(`🐕 Auto-triggering watchdog: ${elapsedMinutes}min no progress, ${totalElapsedMinutes}min total elapsed`)
            handleForceUnstick()
          }
        }
      }
    } else {
      // Progress detected - reset timer
      setLastProcessedCount(currentProcessed)
      setNoProgressSince(null)
    }
  }, [importRun.processed_count, importRun.status, lastProcessedCount, noProgressSince])

  const getElapsedTime = () => {
    if (!importRun.started_at) return 'Unknown'
    
    const startTime = new Date(importRun.started_at).getTime()
    const currentTime = Date.now()
    const elapsedMs = currentTime - startTime
    
    const minutes = Math.floor(elapsedMs / 60000)
    const seconds = Math.floor((elapsedMs % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const getNoProgressTime = () => {
    if (!noProgressSince) return null
    
    const elapsedMs = Date.now() - noProgressSince.getTime()
    const minutes = Math.floor(elapsedMs / 60000)
    const seconds = Math.floor((elapsedMs % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const getStatusIcon = () => {
    switch (importRun.status) {
      case 'RUNNING':
        return <Loader className="h-4 w-4 text-blue-500 animate-spin" />
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PARTIAL':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const handleAbort = async () => {
    try {
      setIsAborting(true)
      
      const { error } = await supabase.functions.invoke('import-abort', {
        body: { runId: importRun.id }
      })
      
      if (error) throw error
      
      toast.success('Import cancelled successfully')
    } catch (error) {
      console.error('Failed to abort import:', error)
      toast.error('Failed to cancel import')
    } finally {
      setIsAborting(false)
    }
  }

  const handleForceUnstick = async () => {
    try {
      setIsUnsticking(true)
      
      const { error } = await supabase.functions.invoke('import-watchdog', {
        body: { thresholdMinutes: 1 } // Short threshold to unstick immediately
      })
      
      if (error) throw error
      
      toast.success('Forced unstick completed')
    } catch (error) {
      console.error('Failed to force unstick:', error)
      toast.error('Failed to unstick import')
    } finally {
      setIsUnsticking(false)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <span className="font-medium text-sm">{title}</span>
              <Badge variant="secondary" className="ml-2">
                {importRun.status}
              </Badge>
            </div>
          </div>
          
          {importRun.status === 'RUNNING' && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleForceUnstick}
                disabled={isUnsticking}
                className="text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {isUnsticking ? 'Unsticking...' : 'Force Unstick'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAbort}
                disabled={isAborting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-3 w-3 mr-1" />
                {isAborting ? 'Cancelling...' : 'Cancel Import'}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Elapsed time</span>
            <span className="font-mono">{getElapsedTime()}</span>
          </div>
          
          {noProgressSince && importRun.status === 'RUNNING' && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">No progress for</span>
              <span className="font-mono text-orange-600">{getNoProgressTime()}</span>
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium">{importRun.processed_count || 0}</div>
              <div className="text-xs text-muted-foreground">Processed</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-green-600">{importRun.created_count || 0}</div>
              <div className="text-xs text-muted-foreground">Created</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-blue-600">{importRun.updated_count || 0}</div>
              <div className="text-xs text-muted-foreground">Updated</div>
            </div>
          </div>
          
          {importRun.errors && importRun.errors.length > 0 && (
            <div className="text-center">
              <div className="font-medium text-red-600">{importRun.errors.length}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          )}
        </div>

        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDetails ? 'Hide details' : 'Show details'}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started at:</span>
                <span>{importRun.started_at ? new Date(importRun.started_at).toLocaleTimeString() : 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last activity:</span>
                <span>{importRun.last_updated_at ? new Date(importRun.last_updated_at).toLocaleTimeString() : 'At start'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trigger:</span>
                <span>Manual</span>
              </div>
              {importRun.errors && importRun.errors.length > 0 && (
                <div className="mt-2">
                  <div className="text-muted-foreground mb-1">Recent errors:</div>
                  {importRun.errors.slice(-3).map((error: string, idx: number) => (
                    <div key={idx} className="text-red-600 text-xs truncate">{error}</div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {noProgressSince && importRun.status === 'RUNNING' && (
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            💡 Import appears stuck. Try "Force Unstick" or "Cancel Import" to resolve.
          </div>
        )}
      </div>
    </Card>
  )
}