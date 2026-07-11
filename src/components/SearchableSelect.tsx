import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { cn } from './ui';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: string;
  maxVisible?: number;
}

// A searchable, keyboard-friendly dropdown for very large option lists
// (e.g. all world countries/states/cities) without needing a native <select>
// with thousands of <option> tags, which is slow and unsearchable on mobile.
export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  loading = false,
  disabled = false,
  emptyText = 'No results found',
  maxVisible = 200,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(
    () => options.find(o => o.value === value)?.label || '',
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    return list;
  }, [options, query]);

  const visible = filtered.slice(0, maxVisible);
  const hiddenCount = filtered.length - visible.length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="text-[11px] font-bold text-gray-400 uppercase mb-1.5 block">{label}</label>}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full bg-skrim-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-neon-purple/50 flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <span className={cn("truncate text-left", !selectedLabel && "text-gray-500")}>
          {loading ? 'Loading…' : selectedLabel || placeholder}
        </span>
        {loading ? (
          <Loader2 className="w-4 h-4 text-gray-400 shrink-0 animate-spin" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {open && !loading && (
        <div className="absolute z-50 mt-2 w-full min-w-[260px] max-h-[320px] bg-skrim-surface border border-white/10 rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0">
            <Search className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-500"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {visible.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">{emptyText}</div>
            )}
            {visible.map(o => (
              <button
                type="button"
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                  o.value === value ? "bg-white/10 text-white" : "text-gray-200"
                )}
              >
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            ))}
            {hiddenCount > 0 && (
              <div className="px-3 py-2 text-[11px] text-gray-500 text-center border-t border-white/5">
                +{hiddenCount.toLocaleString()} more — keep typing to narrow down
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
