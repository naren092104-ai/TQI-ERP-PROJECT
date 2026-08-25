import React from 'react';

interface LottieIllustrationProps {
  type: 'empty-notifications' | 'empty-approvals' | 'analytics' | 'finance' | 'students';
  className?: string;
  size?: number;
}

export const LottieIllustration: React.FC<LottieIllustrationProps> = ({
  type,
  className = '',
  size = 64,
}) => {
  if (type === 'empty-notifications') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground/60 transition-colors"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          <circle cx="18" cy="6" r="2" className="fill-primary stroke-background stroke-2" />
        </svg>
      </div>
    );
  }

  if (type === 'empty-approvals') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-500/80 transition-colors"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/60 transition-colors"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
  );
};
