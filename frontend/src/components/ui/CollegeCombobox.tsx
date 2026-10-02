import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { apiUrl } from '../../utils/api';

export interface CollegeOption {
  id: string;
  name: string;
  district: string;
  university?: string;
  type?: string;
  collegeType?: string;
  institutionCategory?: string;
}

const normalizeForSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const editDistance = (left: string, right: string) => {
  if (Math.abs(left.length - right.length) > 1) return 2;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + cost);
      rowMinimum = Math.min(rowMinimum, current[column]);
    }
    if (rowMinimum > 1) return 2;
    previous = current;
  }
  return previous[right.length];
};

interface CollegeComboboxProps {
  value: string;
  onChange: (college: CollegeOption | null, typedValue?: string) => void;
  authToken?: string;
  placeholder?: string;
  required?: boolean;
}

export const CollegeCombobox: React.FC<CollegeComboboxProps> = ({
  value,
  onChange,
  authToken,
  placeholder = 'Search by college, district, or university',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<CollegeOption[] | null>(null);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const directoryLoadingRef = useRef(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || query.trim().length < 2 || directory || directoryLoadingRef.current) return;
    directoryLoadingRef.current = true;
    setIsLoadingDirectory(true);
    setDirectoryError('');
    fetch(apiUrl('/api/colleges'), {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      cache: 'force-cache',
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.colleges)) {
          throw new Error(data?.error || 'Unable to load the Tamil Nadu college directory.');
        }
        setDirectory(data.colleges);
      })
      .catch((error: any) => {
        if (error?.name !== 'AbortError') setDirectoryError(error?.message || 'Unable to load the Tamil Nadu college directory.');
      })
      .finally(() => {
        directoryLoadingRef.current = false;
        setIsLoadingDirectory(false);
      });
  }, [authToken, directory, isLoadingDirectory, isOpen, query]);

  const options = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query);
    if (!directory || normalizedQuery.length < 2) return [];

    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const filtered = directory.filter((college) => {
      const searchable = normalizeForSearch(`${college.name} ${college.district} ${college.university || ''}`);
      const compactSearchable = searchable.replace(/ /g, '');
      const matchesSearch = !normalizedQuery
        || searchable.includes(normalizedQuery)
        || compactSearchable.includes(normalizedQuery.replace(/ /g, ''))
        || queryTokens.every((token) => searchable.split(' ').some((word) => word === token || (token.length >= 4 && word.length >= 4 && editDistance(token, word) <= 1)));
      return matchesSearch;
    });
    return filtered.sort((first, second) =>
      normalizeForSearch(first.name).localeCompare(normalizeForSearch(second.name), 'en', { sensitivity: 'base' })
      || first.id.localeCompare(second.id, 'en', { sensitivity: 'base' }),
    );
  }, [directory, query]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const choose = (college: CollegeOption) => {
    onChange(college);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-2 block text-xs font-semibold text-slate-600">College / Institution</label>
      <div className={`flex w-full items-center gap-2 rounded-2xl border bg-white px-3.5 py-3 shadow-sm transition focus-within:border-[#0B3D91] focus-within:ring-4 focus-within:ring-blue-100 ${isOpen ? 'border-[#0B3D91]' : 'border-slate-200'}`}>
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={isOpen ? query : value}
          onFocus={() => { setQuery(''); setIsOpen(true); }}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setHighlightedIndex(-1);
            setIsOpen(true);
            onChange(null, next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlightedIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlightedIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && highlightedIndex >= 0 && options[highlightedIndex]) {
              event.preventDefault();
              choose(options[highlightedIndex]);
            } else if (event.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          required={required}
          placeholder={placeholder}
          aria-label="College name"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && <div className="absolute z-[1000000] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
        {query.trim().length < 2 ? <p className="px-3 py-3 text-xs text-slate-500">Type at least 2 letters to search the Tamil Nadu college directory.</p>
              : isLoadingDirectory ? <p className="px-3 py-3 text-xs text-slate-500">Loading colleges from the TQI backend…</p>
              : directoryError ? <p className="px-3 py-3 text-xs text-rose-700">{directoryError} You can still enter the college name manually.</p>
              : options.length ? <><p className="sticky top-0 z-10 border-b border-slate-100 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{options.length.toLocaleString()} matching colleges · sorted A–Z · all Tamil Nadu districts</p>{options.map((college, index) => <button key={college.id} type="button" onMouseEnter={() => setHighlightedIndex(index)} onClick={() => choose(college)} className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left ${index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-800">{college.name}</span><span className="mt-0.5 block text-[11px] text-slate-500">{college.district}{college.university ? ` · ${college.university}` : ''}</span></span>
                {value.toLowerCase() === college.name.toLowerCase() && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              </button>)}</>
                : <p className="px-3 py-3 text-xs text-slate-500">No college matches found. You can use the name you typed.</p>}
      </div>}
    </div>
  );
};
