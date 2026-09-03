import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-brand-dark",
        secondary:
          "border-transparent bg-muted text-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:opacity-90",
        outline: "text-foreground border-border",
        success: "bg-success-bg text-success border-success-border",
        warning: "bg-warning-bg text-warning-fg border-warning-border",
        error: "bg-error-bg text-error border-error-border",
        info: "bg-info-bg text-info border-info-border",
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
