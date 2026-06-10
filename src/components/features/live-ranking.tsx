'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useSocketEvent } from '@/hooks/use-socket';
import { RankingTable } from './ranking-table';
import { Skeleton } from '@/components/ui/skeleton';
import type { RankingEntry } from '@/server/ranking/ranking.service';

interface LiveRankingProps {
  poolId: string;
  highlightUserId?: string;
}

/** Ranking que se atualiza sozinho via Socket.IO. */
export function LiveRanking({ poolId, highlightUserId }: LiveRankingProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['ranking', poolId],
    queryFn: () => api<{ entries: RankingEntry[] }>(`/api/pools/${poolId}/ranking`),
    select: (d) => d.entries,
  });

  useSocketEvent<{ poolId: string; entries: RankingEntry[] }>(
    'ranking:update',
    (payload) => {
      if (payload.poolId === poolId) {
        queryClient.setQueryData(['ranking', poolId], { entries: payload.entries });
      }
    },
    [`pool:${poolId}`],
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return <RankingTable entries={data ?? []} highlightUserId={highlightUserId} />;
}
