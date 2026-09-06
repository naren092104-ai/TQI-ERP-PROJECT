import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium transition-colors border select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border-primary/25",
        secondary:
          "bg-muted/80 text-foreground border-border",
        destructive:
          "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60",
        outline: "text-foreground border-border bg-card",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60",
        warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
        error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60",
        info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-[11px]",
        lg: "px-3 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  color?: string;
  size?: "sm" | "md" | "lg" | any;
  variant?: any;
}

function Badge({ className, variant, color, size, ...props }: BadgeProps) {
  // If color is passed, map it to matching variant
  let resolvedVariant = variant;
  if (!resolvedVariant && color) {
    if (color === "success") resolvedVariant = "success";
    else if (color === "warning") resolvedVariant = "warning";
    else if (color === "error" || color === "destructive") resolvedVariant = "destructive";
    else if (color === "info" || color === "primary") resolvedVariant = "default";
    else resolvedVariant = "secondary";
  }

  const resolvedSize = size === "sm" || size === "md" || size === "lg" ? size : "md";

  return (
    <div
      className={cn(badgeVariants({ variant: resolvedVariant, size: resolvedSize }), className)}
      {...props}
    />
  );
}

export default Badge;
export { Badge, badgeVariants };
