import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Info, 
  Check, 
  ArrowRight
} from 'lucide-react';
import { TabType, NotificationItem } from '../types';
import { LottieIllustration } from './LottieIllustration';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onNavigate: (tab: TabType, targetId?: string) => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onNavigate,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'correction' | 'approval'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'correction') return n.type === 'correction';
    if (filter === 'approval') return n.type === 'approval';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const tabs = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'correction', label: 'Corrections', count: notifications.filter((n) => n.type === 'correction').length },
    { key: 'approval', label: 'Approvals', count: notifications.filter((n) => n.type === 'approval').length },
  ] as const;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'correction':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case 'approval':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'session':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread updates require your attention` : 'All caught up • No pending notifications'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button 
            type="button"
            onClick={onMarkAllAsRead} 
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Check className="h-4 w-4" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-8 border-b border-border/40 text-sm font-medium">
        {tabs.map((t) => {
          const isActive = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`relative pb-3.5 transition-colors ${
                isActive 
                  ? 'text-foreground font-semibold' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span className={`text-xs ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                    ({t.count})
                  </span>
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List / Beautiful Centered Empty State */}
      <div className="w-full">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <LottieIllustration type="empty-notifications" size={96} className="mb-4" />
            <h3 className="text-base font-bold text-foreground">No notifications here</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {filter === 'unread'
                ? 'You have no unread notifications.'
                : 'There are no notifications matching this category at this time.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-5 px-3 transition-colors hover:bg-muted/30 ${
                  !item.isRead ? 'bg-muted/10' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 shrink-0">
                    {getIcon(item.type)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!item.isRead ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.message}
                    </p>
                    <span className="text-xs text-muted-foreground/70 block pt-0.5">
                      {item.timeAgo}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                  {item.actionTab && (
                    <button
                      type="button"
                      onClick={() => onNavigate(item.actionTab!, item.targetId)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
                    >
                      <span>{item.actionLabel || 'View Record'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => onMarkAsRead(item.id)}
                      title="Mark as read"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
