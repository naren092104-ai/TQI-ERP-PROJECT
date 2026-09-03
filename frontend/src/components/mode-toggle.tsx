import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor, Check } from './ui/icons';
import { useTheme } from './theme-provider';

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        aria-label="Toggle theme"
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
          <button
            type="button"
            onClick={() => { setTheme('light'); setOpen(false); }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              theme === 'light' ? 'bg-muted text-foreground font-bold' : 'hover:bg-muted/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              Light
            </span>
            {theme === 'light' && <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setTheme('dark'); setOpen(false); }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              theme === 'dark' ? 'bg-muted text-foreground font-bold' : 'hover:bg-muted/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-indigo-400" />
              Dark
            </span>
            {theme === 'dark' && <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setTheme('system'); setOpen(false); }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
              theme === 'system' ? 'bg-muted text-foreground font-bold' : 'hover:bg-muted/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              System
            </span>
            {theme === 'system' && <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
