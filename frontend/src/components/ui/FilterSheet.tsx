import React, { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * FilterSheet — shows filters inline on desktop, behind a "Filters" button
 * in a bottom sheet on mobile. Wraps any set of filter inputs.
 *
 * Usage:
 *   <FilterSheet onApply={() => setPage(1)}>
 *     <SelectField label="Cluster" ... />
 *     <SelectField label="Status" ... />
 *     <InputField label="Search" ... />
 *   </FilterSheet>
 */

interface FilterSheetProps {
  children: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  /** Active filter count badge shown on the trigger button. */
  activeCount?: number;
  /** Side label for the trigger button. */
  label?: string;
  /** Force mobile or desktop rendering. */
  force?: "mobile" | "desktop";
}

const MOBILE_QUERY = "(max-width: 768px)";

function useMediaQuery(query: string) {
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
}

export const FilterSheet: React.FC<FilterSheetProps> = ({
  children,
  onApply,
  onReset,
  activeCount = 0,
  label = "Filters",
  force,
}) => {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  const showAsSheet = force === "mobile" || (force !== "desktop" && isMobile);

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open && showAsSheet) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, showAsSheet]);

  if (!showAsSheet) {
    // Desktop: render filters inline
    return (
      <div
        className="tqi-toolbar tqi-stack-mobile"
        style={{
          flexWrap: "wrap",
          padding: "0.5rem 0.75rem",
          gap: "0.5rem",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tqi-btn-outline tqi-touch"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          height: 40,
          padding: "0 0.875rem",
          position: "relative",
        }}
        aria-label={`Open ${label}`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span style={{ fontWeight: 600 }}>{label}</span>
        {activeCount > 0 && (
          <span
            className="tqi-chip tqi-chip-brand"
            style={{ minWidth: 22, height: 20, padding: "0 0.4rem" }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="tqi-sheet-backdrop" onClick={() => setOpen(false)} />
          <div
            className="tqi-sheet"
            data-open="true"
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="tqi-sheet-handle" />
            <div className="tqi-sheet-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--brand)" }} />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)" }}>
                  {label}
                  {activeCount > 0 && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: "var(--text-muted)",
                      }}
                    >
                      · {activeCount} active
                    </span>
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="tqi-touch"
                style={{ color: "var(--text-muted)" }}
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="tqi-sheet-body"
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
            >
              {children}
            </div>
            <div className="tqi-sheet-footer">
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="tqi-btn-ghost tqi-touch"
                  style={{ height: 40, padding: "0 0.875rem" }}
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onApply?.();
                  setOpen(false);
                }}
                className="tqi-btn-primary tqi-touch"
                style={{ height: 40, padding: "0 1.25rem" }}
              >
                Apply filters
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default FilterSheet;
