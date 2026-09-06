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
  error = null,
  onRetry,
  className = '',
}) => {
  const containerClasses = fullScreen
    ? `fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm transition-opacity duration-300 ${className}`
    : `relative w-full py-16 flex flex-col items-center justify-center bg-transparent ${className}`;

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
        <div className="flex flex-col items-center text-center px-4 max-w-md animate-in fade-in zoom-in-95 duration-200">
          {/* Logo with warning badge */}
          <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20" />
            <div className="relative z-10 flex items-center justify-center p-3">
              <TqiLogo size={56} className="h-14 w-14 object-contain select-none opacity-90" />
            </div>
            <div className="absolute bottom-1 right-1 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md ring-2 ring-white dark:ring-slate-900">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Unable to load TQI ERP
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {error || 'Please try again.'}
          </p>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1717B8] hover:bg-[#1313A0] text-white text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1717B8] focus:ring-offset-2 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
          )}
        </div>
      ) : (
        /* Genuine Loading Experience */
        <div className="flex flex-col items-center text-center px-4 max-w-sm animate-in fade-in duration-200">
          {/* Circular loading ring rotating around stationary TQI logo */}
          <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32">
            {/* SVG Loading Ring with smooth GPU-accelerated rotation */}
            <svg
              className="absolute inset-0 w-full h-full animate-spin"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ animationDuration: '1.2s' }}
              aria-hidden="true"
            >
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-slate-200 dark:text-slate-800"
              />
              {/* Active Rotating Arc with TQI Brand Gradient */}
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="url(#tqi-loader-ring-gradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="220"
                strokeDashoffset="145"
              />
              <defs>
                <linearGradient id="tqi-loader-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1717B8" />
                  <stop offset="55%" stopColor="#008C8C" />
                  <stop offset="100%" stopColor="#FF6B2C" />
                </linearGradient>
              </defs>
            </svg>

            {/* Stationary Centered TQI Logo */}
            <div className="relative z-10 flex items-center justify-center p-3 select-none">
              <TqiLogo size={56} className="h-14 w-14 object-contain" />
            </div>
          </div>

          {/* Branded Loading Typography */}
          <div className="mt-6 space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              {message}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              {subMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TqiLoadingScreen;
