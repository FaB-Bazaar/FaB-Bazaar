"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.ComponentPropsWithoutRef<'div'> {
  variant?: 'secondary' | 'destructive';
}

const Badge = React.forwardRef<React.ElementRef<'div'>, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          variant === "secondary"
            ? "bg-secondary text-secondary-foreground"
            : variant === "destructive"
              ? "bg-destructive text-destructive-foreground"
              : "bg-muted text-muted-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Badge.displayName = "Badge"

export { Badge }
