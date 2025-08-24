import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Clock, Info, XCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

interface LiveSyncStatusPanelProps {
  syncRun: any
  title: string
}

export function LiveSyncStatusPanel({ syncRun, title }: LiveSyncStatusPanelProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const getElapsedTime = () => {
    if (!syncRun?.started_at) return "0s"
    const elapsed = Math.floor((new Date().getTime() - new Date(syncRun.started_at).getTime()) / 1000)
    if (elapsed < 60) return `${elapsed}s`
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}m ${seconds}s`
  }

  const getStatusIcon = () => {
    switch (syncRun?.status) {
      case 'RUNNING':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'PENDING':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <Badge variant="secondary" className="animate-pulse">
          {syncRun?.status || 'PENDING'}
        </Badge>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">
            {syncRun?.status === 'RUNNING' ? 'Syncing in progress...' : 'Queued for processing'}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Elapsed time</span>
          <span className="font-mono">{getElapsedTime()}</span>
        </div>

        {syncRun?.processed_count !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono">
                {syncRun.processed_count || 0} processed
              </span>
            </div>
            
            {syncRun.created_count !== undefined && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-600">
                  ✓ {syncRun.created_count || 0} created
                </span>
                <span className="text-blue-600">
                  ↻ {syncRun.updated_count || 0} updated
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      <Separator />

      <Collapsible open={showDetails} onOpenChange={setShowDetails}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-3 w-3" />
              <span className="text-xs">Sync Details</span>
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="text-xs space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Started:</span>
              <span>{syncRun?.started_at ? new Date(syncRun.started_at).toLocaleTimeString() : 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span>{syncRun?.direction === 'OUT' ? 'Push to Square' : 'Import from Square'}</span>
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