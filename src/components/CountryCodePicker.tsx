import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { COUNTRY_CODES, CountryCode } from '../constants/countryCodes';
import { cn } from './ui';

interface CountryCodePickerProps {
  value: string;
  onChange: (dialCode: string) => void;
  className?: string;
}

export default function CountryCodePicker({ value, onChange, className }: CountryCodePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => COUNTRY_CODES.find(c => c.dialCode === value) || COUNTRY_CODES.find(c => c.iso2 === 'IN')!,
    [value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.replace('+', '').includes(q.replace('+', '')) ||
        c.iso2.toLowerCase() === q
    );
  }, [query]);

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
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "bg-skrim-surface border border-gray-800 rounded-xl px-3 py-3 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 transition-all text-white min-w-[92px] flex items-center justify-between gap-1",
          className
        )}
      >
        <span className="flex items-center gap-1 truncate">
          <span>{selected.flag}</span>
          <span>{selected.dialCode}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[280px] max-h-[320px] bg-skrim-surface border border-gray-800 rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
            <Search className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-500"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No countries found</div>
            )}
            {filtered.map(c => (
              <button
                type="button"
                key={c.iso2}
                onClick={() => {
                  onChange(c.dialCode);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors",
                  c.dialCode === value && c.iso2 === selected.iso2 ? "bg-white/10" : ""
                )}
              >
                <span className="text-base">{c.flag}</span>
                <span className="flex-1 text-white truncate">{c.name}</span>
                <span className="text-gray-400">{c.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
