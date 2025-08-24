import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface SplitButtonProps {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  popoverContent: React.ReactNode
  popoverSide?: "top" | "right" | "bottom" | "left"
  isActive?: boolean
  activeLabel?: string
}

export function SplitButton({
  children,
  onClick,
  disabled = false,
  variant = "outline",
  size = "default",
  className,
  popoverContent,
  popoverSide = "bottom",
  isActive = false,
  activeLabel
}: SplitButtonProps) {
  const activeButtonClass = isActive 
    ? "bg-muted text-muted-foreground border-dashed animate-pulse" 
    : "";

  return (
    <div className={cn("flex", className)}>
      <Button
        onClick={onClick}
        disabled={disabled}
        variant={variant}
        size={size}
        className={cn("rounded-r-none border-r-0", activeButtonClass)}
      >
        <div className="flex items-center gap-2">
          {children}
          {isActive && activeLabel && (
            <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded-full">
              {activeLabel}
            </span>
          )}
        </div>
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={disabled}
            className={cn("rounded-l-none px-2 border-l", activeButtonClass)}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side={popoverSide}
          align="end" 
          className="w-80 p-3"
        >
          {popoverContent}
        </PopoverContent>
      </Popover>
    </div>
  )
}