import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X } from './icons';

export type ModalSize = "sm" | "md" | "lg" | "full";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  isFullscreen?: boolean;
  size?: ModalSize;
  title?: string;
  subtitle?: string;
  /** Render as a bottom sheet on mobile (slides up instead of centered). */
  sheetOnMobile?: boolean;
}

const MOBILE_QUERY = "(max-width: 768px)";

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    setMatches(m.matches);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
};

const sizeMaxWidth: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  full: "max-w-[96vw]",
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  showCloseButton = true,
  isFullscreen = false,
  size = "md",
  title,
  subtitle,
  sheetOnMobile = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  // On mobile, default to full-screen unless the consumer explicitly opted out.
  const mobileFullscreen = isMobile && !className.includes("tqi-modal-no-fullscreen");
  const isFull = isFullscreen || mobileFullscreen || size === "full";
  const asSheet = sheetOnMobile && isMobile && !isFullscreen;

  const contentClasses = isFull
    ? 'w-full h-full'
    : `relative w-full ${sizeMaxWidth[size]} z-10`;

  const containerClasses = asSheet
    ? 'fixed inset-0 z-[80] flex items-end justify-center'
    : 'fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto p-3 sm:p-6';

  const motionStyle: React.CSSProperties = asSheet
    ? {
        animation:
          'tqi-modal-in var(--dur-medium, 480ms) var(--ease-out-expo) both',
      }
    : {
        animation:
          'tqi-modal-in var(--dur-medium, 480ms) var(--ease-out-expo) both',
      };

  return (
    <div className={containerClasses}>
      <div
        className="fixed inset-0 h-full w-full"
        onClick={onClose}
        aria-hidden
        style={{
          background:
            'color-mix(in srgb, color-mix(in srgb, var(--text) 22%, transparent) 80%, transparent)',
          backdropFilter: 'blur(8px) saturate(160%)',
          WebkitBackdropFilter: 'blur(8px) saturate(160%)',
          animation:
            'tqi-fade-in var(--dur-fast, 220ms) var(--ease-out-quart) both',
        }}
      />
      <div
        ref={modalRef}
        className={`${contentClasses} ${asSheet ? 'rounded-t-3xl rounded-b-none' : ''} ${isFull ? '' : 'max-h-[92vh] rounded-2xl'} overflow-y-auto custom-scrollbar ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...motionStyle,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow:
            '0 1px 0 color-mix(in srgb, var(--text-on-brand) 8%, transparent) inset, 0 32px 80px -24px rgba(15, 23, 42, 0.4)',
        }}
      >
        {(title || showCloseButton) && (
          <div
            className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 ${asSheet ? 'rounded-t-3xl' : ''}`}
            style={{
              background:
                'color-mix(in srgb, var(--card) 90%, transparent)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div className="min-w-0 flex-1">
              {title && (
                <h3
                  className="truncate text-[15px] sm:text-[17px] font-semibold tracking-tight"
                  style={{ color: 'var(--text)' }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  className="mt-0.5 truncate text-[12px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="tqi-touch ml-2 inline-flex shrink-0 items-center justify-center transition-all"
                style={{
                  width: 32,
                  height: 32,
                  color: 'var(--text-muted)',
                  background:
                    'color-mix(in srgb, var(--surface) 60%, transparent)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md, 10px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    'color-mix(in srgb, var(--surface) 60%, transparent)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
                aria-label="Close"
              >
                <X size={14} weight="light" />
              </button>
            )}
          </div>
        )}
        <div className={`p-4 sm:p-6 ${isFull ? 'flex-1' : ''}`}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
