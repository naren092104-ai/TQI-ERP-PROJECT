import React from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

/** A single shimmering placeholder block. */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 12,
  radius = 6,
  className,
  style,
}) => (
  <span
    className={`tqi-skeleton ${className ?? ''}`}
    style={{
      display: 'block',
      width,
      height,
      borderRadius: radius,
      ...style,
    }}
    aria-hidden
  />
);

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: number | string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  className,
  lastLineWidth = '60%',
}) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        height={i === 0 ? 14 : 10}
        width={i === lines - 1 ? lastLineWidth : '100%'}
      />
    ))}
  </div>
);

interface SkeletonCardProps {
  rows?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ rows = 3, className }) => (
  <div
    className={`tqi-card ${className ?? ''}`}
    style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Skeleton width={36} height={36} radius={10} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton height={12} width="40%" />
        <Skeleton height={9} width="20%" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} height={10} width={i === rows - 1 ? '60%' : '100%'} />
    ))}
  </div>
);
