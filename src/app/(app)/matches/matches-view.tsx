'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, Layers } from 'lucide-react';
import { api } from '@/lib/api-client';
import { MatchCard, type MatchDTO, type BetDTO } from '@/components/features/match-card';
import { MatchesSidebar } from '@/components/features/matches-sidebar';
import { GroupsView } from '@/components/features/groups-view';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface MatchesViewProps {
  pools: Array<{ id: string; name: string }>;
  currentUserId: string;
}

type FilterKey = 'upcoming' | 'all' | 'today' | 'tomorrow' | 'week' | 'bra' | 'live' | 'finished' | `group:${string}`;

const BASE_FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'upcoming', label: 'Próximos jogos' },
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoje' },
  { value: 'tomorrow', label: 'Amanhã' },
  { value: 'week', label: 'Próx. semana' },
  { value: 'bra', label: '🇧🇷 Brasil' },
  { value: 'live', label: '● Ao vivo' },
  { value: 'finished', label: 'Encerrados' },
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
        (m) => m.homeTeam.code === 'BRA' || m.awayTeam.code === 'BRA',
      );
    case 'live':
      return matches.filter((m) => m.status === 'LIVE');
    case 'finished':
      return matches.filter((m) => m.status === 'FINISHED');
    default:
      if (filter.startsWith('group:')) {
        const groupName = filter.slice(6);
        return matches.filter((m) => m.groupName === groupName);
      }
      return matches;
  }
}

export function MatchesView({ pools, currentUserId }: MatchesViewProps) {
  const [poolId, setPoolId] = useState(pools[0]?.id);
  const [filter, setFilter] = useState<FilterKey>('upcoming');
  const [view, setView] = useState<'palpites' | 'grupos'>('palpites');

  const { data: allMatches, isLoading } = useQuery({
    queryKey: ['matches', 'all'],
    queryFn: () => api<{ matches: MatchDTO[] }>('/api/matches'),
    select: (d) => d.matches,
  });

  const { data: bets } = useQuery({
    queryKey: ['bets', poolId],
    queryFn: () => api<{ bets: BetDTO[] }>(`/api/bets?poolId=${poolId}`),
    select: (d) => d.bets,
    enabled: Boolean(poolId),
  });

  const groupFilters = useMemo(() => {
    const groups = new Set<string>();
    for (const m of allMatches ?? []) {
      if (m.groupName) groups.add(m.groupName);
    }
    return [...groups].sort().map((g) => ({ value: `group:${g}` as FilterKey, label: `Grupo ${g}` }));
  }, [allMatches]);

  if (pools.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Entre em um bolão para palpitar"
        description="Seus palpites valem dentro de cada bolão. Crie um ou entre com um código."
      />
    );
  }

  const betByMatch = new Map((bets ?? []).map((b) => [b.matchId, b]));
  const selectedPool = pools.find((p) => p.id === poolId);
  const filtered = filterMatches(allMatches ?? [], filter);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      {/* Main column */}
      <div className="min-w-0 space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Palpites</h1>
          <p className="text-sm text-muted-foreground">
            Edite à vontade até o apito inicial. Horários no seu fuso local.
          </p>
        </div>

        {/* Pool selector */}
        {pools.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {pools.map((pool) => (
              <button
                key={pool.id}
                onClick={() => setPoolId(pool.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  pool.id === poolId
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {pool.name}
              </button>
            ))}
          </div>
        )}

        {/* View toggle */}
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => setView('palpites')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors',
              view === 'palpites'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <ListChecks className="h-4 w-4" />
            Palpites
          </button>
          <button
            onClick={() => setView('grupos')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 border-l border-border py-2 text-sm font-medium transition-colors',
              view === 'grupos'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <Layers className="h-4 w-4" />
            Grupos
          </button>
        </div>

        {view === 'palpites' ? (
          <>
            {/* Filter chips */}
            <div className="space-y-2">
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
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
                    setFilter(e.target.value ? (`group:${e.target.value}` as FilterKey) : 'all')
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
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
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
          </>
        ) : (
          <GroupsView />
        )}
      </div>

      {/* Sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <MatchesSidebar poolId={poolId} poolName={selectedPool?.name} />
        </div>
      </aside>
    </div>
  );
}
