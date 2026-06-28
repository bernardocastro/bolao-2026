'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { api } from '@/lib/api-client';
import { MatchCard, type MatchDTO, type BetDTO } from '@/components/features/match-card';
import { TopScorerCard } from '@/components/features/top-scorer-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

type FilterKey =
  | 'upcoming'
  | 'all'
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'bra'
  | 'live'
  | 'finished'
  | 'knockout'
  | `group:${string}`;

const BASE_FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'upcoming', label: 'Próximos jogos' },
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoje' },
  { value: 'tomorrow', label: 'Amanhã' },
  { value: 'week', label: 'Próx. semana' },
  { value: 'bra', label: '🇧🇷 Brasil' },
  { value: 'live', label: '● Ao vivo' },
  { value: 'finished', label: 'Encerrados' },
  { value: 'knockout', label: '🏆 Mata-mata' },
];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function filterMatches(matches: MatchDTO[], filter: FilterKey): MatchDTO[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 8);

  switch (filter) {
    case 'upcoming':
      return matches.filter((m) => m.status === 'SCHEDULED' || m.status === 'LIVE');
    case 'today':
      return matches.filter((m) => sameDay(new Date(m.kickoffAt), today));
    case 'tomorrow':
      return matches.filter((m) => sameDay(new Date(m.kickoffAt), tomorrow));
    case 'week':
      return matches.filter((m) => {
        const d = new Date(m.kickoffAt);
        return d >= dayAfterTomorrow && d < weekEnd;
      });
    case 'bra':
      return matches.filter(
        (m) => m.homeTeam?.code === 'BRA' || m.awayTeam?.code === 'BRA',
      );
    case 'live':
      return matches.filter((m) => m.status === 'LIVE');
    case 'finished':
      return matches.filter((m) => m.status === 'FINISHED');
    case 'knockout':
      return matches.filter(
        (m) => m.stage !== 'GROUP' && m.homeTeam !== null && m.awayTeam !== null,
      );
    default:
      if (filter.startsWith('group:')) {
        const groupName = filter.slice(6);
        return matches.filter((m) => m.groupName === groupName);
      }
      return matches;
  }
}

interface PoolBetsProps {
  poolId: string;
  currentUserId: string;
}

export function PoolBets({ poolId, currentUserId }: PoolBetsProps) {
  const [filter, setFilter] = useState<FilterKey>('upcoming');

  const { data: allMatches, isLoading } = useQuery({
    queryKey: ['matches', 'all'],
    queryFn: () => api<{ matches: MatchDTO[] }>('/api/matches'),
    select: (d) => d.matches,
  });

  const { data: bets } = useQuery({
    queryKey: ['bets', poolId],
    queryFn: () => api<{ bets: BetDTO[] }>(`/api/bets?poolId=${poolId}`),
    select: (d) => d.bets,
  });

  const groupFilters = useMemo(() => {
    const groups = new Set<string>();
    for (const m of allMatches ?? []) {
      if (m.groupName) groups.add(m.groupName);
    }
    return [...groups]
      .sort()
      .map((g) => ({ value: `group:${g}` as FilterKey, label: `Grupo ${g}` }));
  }, [allMatches]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (!allMatches?.length) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nenhum jogo disponível"
        description="Os jogos aparecem aqui assim que a tabela é publicada."
      />
    );
  }

  const betByMatch = new Map((bets ?? []).map((b) => [b.matchId, b]));
  const filtered = filterMatches(allMatches, filter);

  return (
    <div className="space-y-4">
      <TopScorerCard poolId={poolId} />

      {/* Filter chips */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {BASE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f.value
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {groupFilters.length > 0 && (
          <select
            value={filter.startsWith('group:') ? filter.slice(6) : ''}
            onChange={(e) =>
              setFilter(
                e.target.value ? (`group:${e.target.value}` as FilterKey) : 'upcoming',
              )
            }
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none',
              filter.startsWith('group:')
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-transparent text-muted-foreground hover:bg-accent',
            )}
          >
            <option value="">Todos os grupos</option>
            {groupFilters.map((g) => (
              <option key={g.value} value={g.value.slice(6)}>
                {g.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Match cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/50 py-12 text-center text-sm text-muted-foreground">
          Nenhum jogo encontrado para este filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              bet={betByMatch.get(match.id)}
              poolId={poolId}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
