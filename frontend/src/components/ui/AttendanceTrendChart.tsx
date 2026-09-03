import React, { useState, useMemo, useId } from 'react';
import { TrendingUp, Info } from './icons';

interface DayDatum {
  day: number;
  label: string;
  completed: number;
  inProgress: number;
  scheduled: number;
  total: number;
}

interface AttendanceTrendChartProps {
  data: DayDatum[];
  height?: number;
  className?: string;
}

/**
 * Premium SVG line+bar chart.
 * Renders cumulative cycle progress across 8 days with a smooth area fill
 * (completed) plus a soft stacked bar overlay (in-progress / scheduled).
 * Hover any day to see a tooltip.
 */
export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({
  data,
  height = 220,
  className,
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const uid = useId();
  const gradId = `tqi-chart-grad-${uid.replace(/:/g, '')}`;
  const dotPatternId = `tqi-chart-dots-${uid.replace(/:/g, '')}`;

  const W = 800;
  const H = height;
  const padL = 36;
  const padR = 12;
  const padT = 18;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yMax = useMemo(() => {
    // The line plots CUMULATIVE completed sessions, so yMax must accommodate
    // the total possible across the full cycle — not just the per-day total.
    // Previously this used `Math.max(10, ...d.total)` which capped at the
    // single-day count (often 1), making an 8/8 cycle read as 80% complete.
    const cumulativeMax = data.reduce((acc, d) => acc + d.total, 0);
    const peakCompleted = data.reduce((acc, d) => acc + d.completed, 0);
    return Math.max(8, cumulativeMax, peakCompleted);
  }, [data]);

  const xFor = (i: number) =>
    data.length === 1
      ? padL + innerW / 2
      : padL + (i * innerW) / (data.length - 1);
  const yFor = (v: number) => padT + innerH - (v / yMax) * innerH;

  // Build cumulative completed line path
  const cumCompleted = useMemo(() => {
    let acc = 0;
    return data.map((d) => ({ ...d, cum: (acc += d.completed) }));
  }, [data]);

  const linePath = useMemo(() => {
    if (cumCompleted.length === 0) return '';
    return cumCompleted
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(d.cum).toFixed(2)}`)
      .join(' ');
  }, [cumCompleted, yMax]);

  const areaPath = useMemo(() => {
    if (cumCompleted.length === 0) return '';
    const top = cumCompleted
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(d.cum).toFixed(2)}`)
      .join(' ');
    const lastX = xFor(cumCompleted.length - 1).toFixed(2);
    const firstX = xFor(0).toFixed(2);
    const baselineY = (padT + innerH).toFixed(2);
    return `${top} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }, [cumCompleted, yMax]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  const totalCompleted = cumCompleted[cumCompleted.length - 1]?.cum ?? 0;
  const finalPct = yMax ? Math.round((totalCompleted / yMax) * 100) : 0;
  const isPositiveTrend = (cumCompleted[cumCompleted.length - 1]?.cum ?? 0) > 0;

  return (
    <div className={`tqi-chart ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Cycle progress
            </h3>
            <span className="tqi-chip tqi-chip-info">
              <span className="tqi-chip-dot" style={{ background: 'var(--brand)' }} />
              Last 8 days
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Daily completed sessions across the active cycle.
          </p>
        </div>
        <div className="text-right">
          <div className="tqi-num text-2xl font-bold leading-none" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
            {totalCompleted}
            <span className="text-sm font-semibold ml-1" style={{ color: 'var(--text-muted)' }}>
              / {yMax}
            </span>
          </div>
          <div className="tqi-num text-[11px] mt-1 flex items-center gap-1 justify-end" style={{ color: isPositiveTrend ? 'var(--success)' : 'var(--text-muted)' }}>
            <TrendingUp className="h-3 w-3" />
            {finalPct}% complete
          </div>
        </div>
      </div>

      <div className="relative" style={{ height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          onMouseLeave={() => setActiveIdx(null)}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
              <stop offset="60%" stopColor="var(--brand)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
            <pattern id={dotPatternId} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="var(--text-muted)" opacity="0.4" />
            </pattern>
          </defs>

          {/* grid lines */}
          <g className="tqi-chart-grid">
            {yTicks.map((t, i) => (
              <line
                key={i}
                x1={padL}
                x2={W - padR}
                y1={yFor(t)}
                y2={yFor(t)}
                strokeDasharray={i === 0 ? '0' : '3 4'}
              />
            ))}
          </g>

          {/* y-axis labels */}
          {yTicks.map((t, i) => (
            <text
              key={i}
              x={padL - 8}
              y={yFor(t) + 3}
              textAnchor="end"
              className="tqi-chart-axis-label"
            >
              {t}
            </text>
          ))}

          {/* x-axis labels */}
          {data.map((d, i) => (
            <text
              key={d.day}
              x={xFor(i)}
              y={H - 8}
              textAnchor="middle"
              className="tqi-chart-axis-label"
            >
              D{d.day}
            </text>
          ))}

          {/* Stacked bar — in-progress / scheduled behind the line */}
          {data.map((d, i) => {
            const x = xFor(i) - 9;
            const completedH = (d.completed / yMax) * innerH;
            const inProgH = (d.inProgress / yMax) * innerH;
            const schedH = (d.scheduled / yMax) * innerH;
            let yCursor = padT + innerH;
            return (
              <g key={`bar-${d.day}`}>
                {d.scheduled > 0 && (
                  <rect
                    x={x}
                    y={(yCursor -= schedH)}
                    width={18}
                    height={schedH}
                    rx={2}
                    fill="var(--brand-xlight)"
                    opacity={0.85}
                  />
                )}
                {d.inProgress > 0 && (
                  <rect
                    x={x}
                    y={(yCursor -= inProgH)}
                    width={18}
                    height={inProgH}
                    rx={2}
                    fill="var(--brand-orange-light)"
                    stroke="var(--brand-orange)"
                    strokeOpacity={0.4}
                  />
                )}
                {d.completed > 0 && (
                  <rect
                    x={x}
                    y={(yCursor -= completedH)}
                    width={18}
                    height={completedH}
                    rx={2}
                    fill="var(--brand)"
                    opacity={0.9}
                  />
                )}
              </g>
            );
          })}

          {/* Area + line on top of bars */}
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1000,
              strokeDashoffset: 1000,
              animation: 'tqi-draw 1.2s var(--ease-out-expo) forwards',
            }}
          />

          {/* Dots + hover targets */}
          {cumCompleted.map((d, i) => {
            const cx = xFor(i);
            const cy = yFor(d.cum);
            const isActive = activeIdx === i;
            return (
              <g key={`dot-${d.day}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 6 : 4}
                  fill="var(--card)"
                  stroke="var(--brand)"
                  strokeWidth="2.25"
                  style={{ transition: 'r 180ms var(--ease-out-back)' }}
                />
                {/* hover target — full column */}
                <rect
                  x={cx - 22}
                  y={padT}
                  width={44}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{ cursor: 'pointer' }}
                />
                {isActive && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={cy}
                    y2={padT + innerH}
                    stroke="var(--brand)"
                    strokeOpacity={0.25}
                    strokeDasharray="2 3"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {activeIdx !== null && cumCompleted[activeIdx] && (
          <div
            className="tqi-chart-tooltip"
            style={{
              left: `calc(${(xFor(activeIdx) / W) * 100}% + 8px)`,
              top: `${(yFor(cumCompleted[activeIdx].cum) / H) * 100}%`,
              transform: 'translateY(-50%)',
            }}
          >
            <div className="font-semibold text-[13px] mb-1">Day {data[activeIdx].day}</div>
            <div className="text-[11px] text-text-muted mb-1.5">{data[activeIdx].label}</div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="tqi-chart-legend-dot" style={{ background: 'var(--brand)' }} />
                <span className="tqi-num font-semibold">{cumCompleted[activeIdx].cum}</span> cum.
              </span>
              <span className="flex items-center gap-1">
                <span className="tqi-chart-legend-dot" style={{ background: 'var(--success)' }} />
                <span className="tqi-num font-semibold">{data[activeIdx].completed}</span> today
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="tqi-chart-legend mt-2">
        <span className="tqi-chart-legend-item">
          <span className="tqi-chart-legend-dot" style={{ background: 'var(--brand)' }} /> Completed
        </span>
        <span className="tqi-chart-legend-item">
          <span className="tqi-chart-legend-dot" style={{ background: 'var(--brand-orange)' }} /> In progress
        </span>
        <span className="tqi-chart-legend-item">
          <span className="tqi-chart-legend-dot" style={{ background: 'var(--brand-xlight)' }} /> Scheduled
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-placeholder)' }}>
          <Info className="h-3 w-3" /> Hover any day
        </span>
      </div>
    </div>
  );
};
