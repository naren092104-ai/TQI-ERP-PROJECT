import React from 'react';
import {
  CalendarCheck,
  ReceiptIndianRupee,
  ShieldCheck,
  Users,
  GraduationCap,
  ChevronRight,
} from './icons';
import { TabType } from '../../types';

export type ActivityKind = 'attendance' | 'finance' | 'approval' | 'enrolment' | 'session';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  meta: string;
  actor: string;
  timestamp: string; // pre-formatted "2h ago"
  /** Raw epoch ms — used to sort items chronologically since the formatted
   *  string ("2h ago", "26 Aug") is not lexicographically comparable. */
  timestampMs?: number;
  status: 'success' | 'pending' | 'warning' | 'info';
  tab?: TabType;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  onItemClick?: (item: ActivityItem) => void;
  emptyLabel?: string;
  className?: string;
}

const kindIcon: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  attendance: CalendarCheck,
  finance: ReceiptIndianRupee,
  approval: ShieldCheck,
  enrolment: GraduationCap,
  session: Users,
};

const statusChipClass: Record<ActivityItem['status'], string> = {
  success: 'tqi-chip tqi-chip-success',
  pending: 'tqi-chip tqi-chip-warning',
  warning: 'tqi-chip tqi-chip-warning',
  info: 'tqi-chip tqi-chip-info',
};

const statusLabel: Record<ActivityItem['status'], string> = {
  success: 'Approved',
  pending: 'Pending',
  warning: 'Review',
  info: 'Logged',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  items,
  onItemClick,
  emptyLabel,
  className,
}) => {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        {emptyLabel ?? 'No activity yet.'}
      </p>
    );
  }

  return (
    <ul className={`tqi-stagger flex flex-col gap-0.5 ${className ?? ''}`}>
      {items.slice(0, 8).map((item) => {
        const Icon = kindIcon[item.kind];
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onItemClick?.(item)}
              className="tqi-activity-item w-full text-left"
            >
              {/* Flat muted square, not a per-kind gradient chip. The icon
                  helps you scan a mixed feed; its colour said nothing. */}
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="tqi-activity-body">
                <div className="tqi-activity-title line-clamp-1">{item.title}</div>
                <div className="tqi-activity-meta">
                  <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {item.actor}
                  </span>
                  <span>&middot;</span>
                  <span>{item.timestamp}</span>
                </div>
              </div>
              {/* Status keeps its colour — this one is real state. */}
              <span className={statusChipClass[item.status]}>
                {statusLabel[item.status]}
              </span>
              {item.tab && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 -ml-1"
                  style={{ color: 'var(--text-muted)' }}
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export const initialsFromName = initials;
