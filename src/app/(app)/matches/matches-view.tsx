'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { api } from '@/lib/api-client';
import { MatchCard, type MatchDTO, type BetDTO } from '@/components/features/match-card';
import { MatchesSidebar } from '@/components/features/matches-sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface MatchesViewProps {
  pools: Array<{ id: string; name: string }>;
}

const ROUNDS = [
  { value: '1', label: 'Rodada 1' },
  { value: '2', label: 'Rodada 2' },
  { value: '3', label: 'Rodada 3' },
];

export function MatchesView({ pools }: MatchesViewProps) {
  const [poolId, setPoolId] = useState(pools[0]?.id);
  const [round, setRound] = useState('1');

  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches', round],
    queryFn: () => api<{ matches: MatchDTO[] }>(`/api/matches?round=${round}`),
    select: (d) => d.matches,
  });
  const { data: bets } = useQuery({
    queryKey: ['bets', poolId],
    queryFn: () => api<{ bets: BetDTO[] }>(`/api/bets?poolId=${poolId}`),
    select: (d) => d.bets,
    enabled: Boolean(poolId),
  });

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
      {/* Main column */}
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Palpites</h1>
          <p className="text-sm text-muted-foreground">
            Edite à vontade até o apito inicial. Horários no seu fuso local.
          </p>
        </div>

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

        <Tabs value={round} onValueChange={setRound}>
          <TabsList className="w-full sm:w-auto">
            {ROUNDS.map((r) => (
              <TabsTrigger key={r.value} value={r.value} className="flex-1 sm:flex-none">
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(matches ?? []).map((match) => (
              <MatchCard key={match.id} match={match} bet={betByMatch.get(match.id)} poolId={poolId} />
            ))}
          </div>
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
