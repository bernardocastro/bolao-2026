'use client';

import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { api } from '@/lib/api-client';
import { MatchCard, type MatchDTO, type BetDTO } from '@/components/features/match-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export function PoolBets({ poolId }: { poolId: string }) {
  const { data: matches, isLoading: loadingMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api<{ matches: MatchDTO[] }>('/api/matches'),
    select: (d) => d.matches,
  });
  const { data: bets, isLoading: loadingBets } = useQuery({
    queryKey: ['bets', poolId],
    queryFn: () => api<{ bets: BetDTO[] }>(`/api/bets?poolId=${poolId}`),
    select: (d) => d.bets,
  });

  if (loadingMatches || loadingBets) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (!matches?.length) {
    return <EmptyState icon={ListChecks} title="Nenhum jogo disponível" description="Os jogos aparecem aqui assim que a tabela é publicada." />;
  }

  const betByMatch = new Map((bets ?? []).map((b) => [b.matchId, b]));

  return (
    <div className="space-y-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} bet={betByMatch.get(match.id)} poolId={poolId} />
      ))}
    </div>
  );
}
