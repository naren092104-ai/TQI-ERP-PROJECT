import React from 'react';
import { ArrowRight, Plus, RefreshCw as ArrowClockwise } from './icons';

interface EmptyStateProps {
  icon: React.ComponentType<any>;
  title: string;
  body?: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'brand' | 'success' | 'warning' | 'neutral';
}

const variantStyles: Record<NonNullable<EmptyStateProps['variant']>, string> = {
  brand: 'background: linear-gradient(135deg, var(--brand-light) 0%, var(--teal-bg) 100%); color: var(--brand);',
  success: 'background: linear-gradient(135deg, var(--success-bg) 0%, #fff 100%); color: var(--success);',
  warning: 'background: linear-gradient(135deg, #FFF7E6 0%, #fff 100%); color: #B7791F;',
  neutral: 'background: var(--surface); color: var(--text-muted);',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  body,
  description,
  primaryAction,
  secondaryAction,
  actionLabel,
  onAction,
}) => {
  const resolvedBody = body || description;
  const resolvedPrimaryAction = primaryAction || (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-card/50">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {resolvedBody && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{resolvedBody}</p>}
      {(resolvedPrimaryAction || secondaryAction) && (
        <div className="mt-4 flex items-center gap-2">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs hover:bg-surface-hover"
            >
              <ArrowClockwise className="h-3.5 w-3.5" />
              <span>{secondaryAction.label}</span>
            </button>
          )}
          {resolvedPrimaryAction && (
            <button
              type="button"
              onClick={resolvedPrimaryAction.onClick}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs hover:bg-brand-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{resolvedPrimaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
