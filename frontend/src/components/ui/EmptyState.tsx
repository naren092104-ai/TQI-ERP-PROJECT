import React from 'react';
import { ArrowRight, Plus, RefreshCw as ArrowClockwise } from './icons';

interface EmptyStateProps {
  icon: React.ComponentType<any>;
  title: string;
  body?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
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
  primaryAction,
  secondaryAction,
  variant = 'brand',
}) => (
  <div className="tqi-empty">
    <div
      className="tqi-empty-illustration"
      style={{
        width: 88,
        height: 88,
        borderRadius: 24,
        ...Object.fromEntries(
          variantStyles[variant]
            .split(';')
            .map((s) => s.split(':'))
            .filter((kv) => kv.length === 2)
            .map(([k, v]) => [k.trim(), v.trim()])
        ),
      }}
    >
      <Icon className="h-9 w-9" />
    </div>
    <p className="tqi-empty-title">{title}</p>
    {body && <p className="tqi-empty-body">{body}</p>}
    {(primaryAction || secondaryAction) && (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="tqi-cta-secondary tqi-btn-outline"
            style={{ height: 36, padding: '0 0.875rem' }}
          >
            <ArrowClockwise className="h-3.5 w-3.5" />
            <span>{secondaryAction.label}</span>
          </button>
        )}
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="tqi-cta tqi-btn-primary"
            style={{ height: 36, padding: '0 0.875rem' }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{primaryAction.label}</span>
            <span className="tqi-cta-icon">
              <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        )}
      </div>
    )}
  </div>
);
