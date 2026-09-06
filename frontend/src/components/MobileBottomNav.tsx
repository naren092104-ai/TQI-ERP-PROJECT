import React from 'react';
import { CalendarCheck, ClipboardText, DotsThree, House } from './ui/icons';
import { TabType } from '../types';

interface MobileBottomNavProps {
  currentTab: TabType | string;
  onNavigate: (tab: TabType) => void;
  onMore: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentTab, onNavigate, onMore }) => {
  const items: Array<{ id: TabType; label: string; icon: React.ComponentType<any> }> = [
    { id: 'dashboard', label: 'Home', icon: House },
    { id: 'sessions', label: 'Sessions', icon: ClipboardText },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  ];

  return (
    <nav className="tqi-mobile-bottom-nav" aria-label="Primary mobile navigation">
      {items.map(({ id, label, icon: Icon }) => {
        const active = currentTab === id;
        return (
          <button
            key={id}
            type="button"
            className="tqi-mobile-bottom-nav-item"
            data-active={active}
            onClick={() => onNavigate(id)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={19} weight={active ? 'fill' : 'regular'} />
            <span>{label}</span>
          </button>
        );
      })}
      <button type="button" className="tqi-mobile-bottom-nav-item" onClick={onMore}>
        <DotsThree size={19} weight="bold" />
        <span>More</span>
      </button>
    </nav>
  );
};
