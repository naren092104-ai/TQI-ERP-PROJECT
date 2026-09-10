import React from 'react';
import { TqiLogo } from './TqiLogo';
import { AlertCircle, RefreshCw } from './ui/icons';

export interface TqiLoadingScreenProps {
  /** Primary title text. Defaults to "Loading..." */
  message?: string;
  /** Secondary subtitle text. Defaults to "Preparing your TQI workspace" */
  subMessage?: string;
  /** Whether to render as fixed full screen. Defaults to true. */
  fullScreen?: boolean;
  /** Size variant: 'compact' (default, sleek & refined) or 'medium' */
  size?: 'compact' | 'medium';
  /** If provided, renders the error state with retry action instead of spinner. */
  error?: string | null;
  /** Callback triggered when the user clicks [ Try Again ]. */
  onRetry?: () => void;
  /** Optional custom CSS classes for the container. */
  className?: string;
}

export const TqiLoadingScreen: React.FC<TqiLoadingScreenProps> = ({
  message = 'Loading...',
  subMessage = 'Preparing your TQI workspace',
  fullScreen = true,
  size = 'compact',
  error = null,
  onRetry,
  className = '',
}) => {
  const containerClasses = fullScreen
    ? `fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 dark:bg-slate-950/95 backdrop-blur-xs transition-opacity duration-200 ${className}`
    : `relative w-full py-12 flex flex-col items-center justify-center bg-transparent ${className}`;

  const isCompact = size === 'compact';
  const ringSize = isCompact ? 'w-14 h-14' : 'w-18 h-18';
  const logoSize = isCompact ? 32 : 40;
  const logoClass = isCompact ? 'h-8 w-8' : 'h-10 w-10';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!error}
      className={containerClasses}
    >
      {/* Screen Reader Announcements */}
      <span className="sr-only">
        {error ? `Error: Unable to load TQI ERP. ${error}` : `${message} ${subMessage}`}
      </span>

      {error ? (
        /* Error State */
        <div className="flex flex-col items-center text-center px-4 max-w-sm animate-in fade-in zoom-in-95 duration-150">
          {/* Logo with warning badge */}
          <div className={`relative flex items-center justify-center ${ringSize} mb-3.5`}>
            <div className="absolute inset-0 rounded-full border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20" />
            <div className="relative z-10 flex items-center justify-center select-none">
              <TqiLogo size={logoSize} className={`${logoClass} object-contain opacity-85`} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 z-20 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs ring-2 ring-white dark:ring-slate-900">
              <AlertCircle className="h-3 w-3" />
            </div>
          </div>

          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Unable to load TQI ERP
          </h2>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
            {error || 'Please try again.'}
          </p>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-xs font-semibold shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-[#1717B8] focus:ring-offset-2 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Try Again</span>
            </button>
          )}
        </div>
      ) : (
        /* Sleek & Compact Loading Experience */
        <div className="flex flex-col items-center text-center px-4 max-w-xs animate-in fade-in duration-150">
          {/* Circular loading ring rotating cleanly around stationary TQI logo */}
          <div className={`relative flex items-center justify-center ${ringSize}`}>
            {/* SVG Loading Ring with smooth GPU-accelerated rotation */}
            <svg
              className="absolute inset-0 w-full h-full animate-spin"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ animationDuration: '1s' }}
              aria-hidden="true"
            >
              {/* Subtle Background Track */}
              <circle
                cx="28"
                cy="28"
                r="25"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-slate-100 dark:text-slate-800/80"
              />
              {/* Active Rotating Arc with TQI Brand Gradient */}
              <circle
                cx="28"
                cy="28"
                r="25"
                stroke="url(#tqi-loader-gradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="125"
                strokeDashoffset="85"
              />
              <defs>
                <linearGradient id="tqi-loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1717B8" />
                  <stop offset="65%" stopColor="#008C8C" />
                  <stop offset="100%" stopColor="#FF6B2C" />
                </linearGradient>
              </defs>
            </svg>

            {/* Stationary Centered TQI Logo */}
            <div className="relative z-10 flex items-center justify-center select-none">
              <TqiLogo size={logoSize} className={`${logoClass} object-contain`} />
            </div>
          </div>

          {/* Clean Branded Typography */}
          <div className="mt-3.5 space-y-0.5">
            <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
              {message}
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {subMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TqiLoadingScreen;
