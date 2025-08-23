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
}

export function SplitButton({
  children,
  onClick,
  disabled = false,
  variant = "outline",
  size = "default",
  className,
  popoverContent,
  popoverSide = "bottom"
}: SplitButtonProps) {
  return (
    <div className={cn("flex", className)}>
      <Button
        onClick={onClick}
        disabled={disabled}
        variant={variant}
        size={size}
        className="rounded-r-none border-r-0"
      >
        {children}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={disabled}
            className="rounded-l-none px-2 border-l"
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