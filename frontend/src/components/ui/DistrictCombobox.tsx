import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, MapPin } from 'lucide-react';

interface DistrictComboboxProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export const DistrictCombobox: React.FC<DistrictComboboxProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select district...',
  required = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(-1);
      setIsOpen(true);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && filteredOptions.length > 0) {
      event.preventDefault();
      handleSelect(filteredOptions[activeIndex] || filteredOptions[0]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-left transition-all ${
          isOpen
            ? 'border-brand-500 ring-2 ring-brand-500/20 dark:border-brand-400'
            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
        } dark:bg-gray-800 text-gray-900 dark:text-white disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          {value ? (
            <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          )}
        </span>

        <span className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-brand-500' : ''
            }`}
          />
        </span>
      </button>

      {required && (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {isOpen && (
        <div className="absolute z-[999999] mt-1 w-full rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800 animate-in fade-in-0 zoom-in-95">
          <div className="relative mb-1 px-1">
            <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id || 'district'}-options`}
              placeholder="Search district or city..."
              className="w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          <div id={`${id || 'district'}-options`} role="listbox" aria-label={label || placeholder} className="max-h-52 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/50">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                No districts found for "{searchQuery}".
              </div>
            ) : (
              filteredOptions.map((item, index) => {
                const isSelected = item.toLowerCase() === value.toLowerCase();
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                      isSelected
                        ? 'bg-brand-50 text-brand-700 font-semibold dark:bg-brand-500/20 dark:text-brand-300'
                        : isActive
                          ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                    }`}
                  >
                    <span className="truncate">{item}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
