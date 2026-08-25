import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-brand-500 text-white hover:bg-brand-600",
        secondary:
          "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        destructive:
          "border-transparent bg-error-500 text-white hover:bg-error-600",
        outline: "text-foreground border-gray-200 dark:border-gray-800",
        success: "border-transparent bg-success-50 text-success-700 border-success-200 dark:bg-success-950/40 dark:text-success-400",
        warning: "border-transparent bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-950/40 dark:text-warning-400",
        error: "border-transparent bg-error-50 text-error-700 border-error-200 dark:bg-error-950/40 dark:text-error-400",
        info: "border-transparent bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400",
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
