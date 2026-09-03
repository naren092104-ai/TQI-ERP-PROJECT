import React from 'react';
import { Compass, ArrowLeft, Search } from './ui/icons';

interface NotFoundViewProps {
  onBack: () => void;
  title?: string;
  message?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  onBack,
  title = 'We can’t find that page',
  message = 'The view you were looking for has been moved, deleted, or never existed.',
}) => {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        animation: 'tqi-rise var(--dur-slow) var(--ease-out-expo)',
      }}
    >
      <div
        className="tqi-empty-illustration"
        style={{
          width: 128,
          height: 128,
          borderRadius: 32,
          marginBottom: '1.5rem',
        }}
      >
        <Compass className="h-12 w-12" />
      </div>

      <p
        className="tqi-num"
        style={{
          fontSize: '5rem',
          fontWeight: 800,
          lineHeight: 0.95,
          letterSpacing: '-0.04em',
          background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-teal) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          marginBottom: '0.5rem',
        }}
      >
        404
      </p>

      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          marginBottom: '0.5rem',
          textAlign: 'center',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          maxWidth: 480,
          textAlign: 'center',
          lineHeight: 1.55,
          marginBottom: '1.75rem',
        }}
      >
        {message}
      </p>

      <div style={{ display: 'flex', gap: '0.625rem' }}>
        <button
          type="button"
          onClick={onBack}
          className="tqi-cta-secondary tqi-btn-outline"
          style={{ height: 40, padding: '0 0.875rem' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to dashboard</span>
        </button>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="tqi-cta tqi-btn-primary"
          style={{ height: 40, padding: '0 0.875rem' }}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search workspace</span>
        </button>
      </div>
    </div>
  );
};
