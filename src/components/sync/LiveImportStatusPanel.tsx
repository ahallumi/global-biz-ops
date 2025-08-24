import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Clock, Info, XCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

interface LiveImportStatusPanelProps {
  importRun: any
  title: string
}

export function LiveImportStatusPanel({ importRun, title }: LiveImportStatusPanelProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const getElapsedTime = () => {
    if (!importRun?.started_at) return "0s"
    const elapsed = Math.floor((new Date().getTime() - new Date(importRun.started_at).getTime()) / 1000)
    if (elapsed < 60) return `${elapsed}s`
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    return `${minutes}m ${seconds}s`
  }

  const getStatusIcon = () => {
    switch (importRun?.status) {
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
          {importRun?.status || 'PENDING'}
        </Badge>
      </div>

      <Card className="p-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">
            {importRun?.status === 'RUNNING' ? 'Import in progress...' : 'Queued for processing'}
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
            
            {importRun.created_count !== undefined && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-600">
                  ✓ {importRun.created_count || 0} created
                </span>
                <span className="text-blue-600">
                  ↻ {importRun.updated_count || 0} updated
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