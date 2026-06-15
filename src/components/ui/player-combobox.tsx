'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopScorerPlayer } from '@/lib/top-scorer-players';

interface PlayerComboboxProps {
  players: TopScorerPlayer[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PlayerCombobox({
  players,
  value,
  onChange,
  placeholder = 'Selecione um jogador...',
  disabled,
  className,
}: PlayerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  useEffect(() => {
    if (open) {
      // defer so the element is mounted first
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setSearch('');
    }
  }, [open]);

  const filtered =
    search.length >= 1
      ? players.filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.country.toLowerCase().includes(search.toLowerCase()),
        )
      : players;

  const byCountry = filtered.reduce<Record<string, TopScorerPlayer[]>>((acc, p) => {
    (acc[p.country] ??= []).push(p);
    return acc;
  }, {});

  const selected = players.find((p) => p.name === value);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors',
          'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
          open && 'ring-2 ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {selected ? (
          <span className="truncate">
            {selected.name}
            <span className="ml-1.5 text-muted-foreground">· {selected.country}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          {/* Search input */}
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar jogador ou seleção..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Player list */}
          <div className="max-h-64 overflow-y-auto">
            {Object.keys(byCountry).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum jogador encontrado
              </p>
            ) : (
              Object.entries(byCountry).map(([country, countryPlayers]) => (
                <div key={country}>
                  <div className="sticky top-0 border-b border-border/50 bg-muted/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                    {country}
                  </div>
                  {countryPlayers.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        onChange(p.name);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                        value === p.name && 'bg-primary/10 font-medium text-primary',
                      )}
                    >
                      {p.name}
                      {value === p.name && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
