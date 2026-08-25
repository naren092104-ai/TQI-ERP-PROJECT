import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "primary" | "success" | "dark" | "outline";
  size?: "sm" | "default" | "lg";
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ className, children, icon, variant = "primary", size = "default", ...props }, ref) => {
    const variantStyles = {
      primary: "bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 text-white",
      success: "bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-600/20 hover:shadow-success-600/30 text-white",
      dark: "bg-gray-900 hover:bg-black text-white shadow-lg shadow-gray-900/20 hover:shadow-gray-900/30 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100",
      outline: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-theme-xs dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300",
    };

    const iconColorStyles = {
      primary: "text-brand-500",
      success: "text-success-600",
      dark: "text-gray-900 dark:text-white",
      outline: "text-gray-700 dark:text-gray-300",
    };

    const sizeStyles = {
      sm: "h-9 min-w-[130px] p-1 pl-4 pr-10 text-xs hover:pl-10 hover:pr-4",
      default: "h-10 min-w-[150px] p-1 pl-5 pr-11 text-xs hover:pl-11 hover:pr-5",
      lg: "h-12 min-w-[184px] p-1 pl-6 pr-14 text-sm hover:pl-14 hover:pr-6",
    };

    const iconCircleSizes = {
      sm: "h-7 w-7 group-hover:right-[calc(100%-32px)]",
      default: "h-8 w-8 group-hover:right-[calc(100%-36px)]",
      lg: "h-10 w-10 group-hover:right-[calc(100%-44px)]",
    };

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-full border-0 font-semibold transition-all duration-500 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 inline-flex items-center justify-center",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {/* Shimmer Overlay */}
        <span
          className="pointer-events-none absolute inset-0 -translate-x-[130%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-[130%]"
        />

        {/* Button Text */}
        <span className="relative z-10 whitespace-nowrap font-medium transition-all duration-300">
          {children}
        </span>

        {/* Sliding Icon Circle */}
        <span
          className={cn(
            "absolute right-1 top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full bg-white shadow-sm transition-[right,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1/2 group-hover:rotate-45 shrink-0",
            iconCircleSizes[size],
            iconColorStyles[variant]
          )}
        >
          {icon || <ArrowUpRight size={size === "sm" ? 13 : size === "default" ? 15 : 17} strokeWidth={2.2} />}
        </span>
      </button>
    );
  }
);
ActionButton.displayName = "ActionButton";
