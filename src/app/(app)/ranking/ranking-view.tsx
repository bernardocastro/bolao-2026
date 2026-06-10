'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Medal } from 'lucide-react';
import { api } from '@/lib/api-client';
import { LiveRanking } from '@/components/features/live-ranking';
import { RankingTable } from '@/components/features/ranking-table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { RankingEntry } from '@/server/ranking/ranking.service';

interface RankingViewProps {
  pools: Array<{ id: string; name: string }>;
  currentUserId: string;
}

export function RankingView({ pools, currentUserId }: RankingViewProps) {
  const [poolId, setPoolId] = useState(pools[0]?.id);

  const { data: global, isLoading: loadingGlobal } = useQuery({
    queryKey: ['ranking', 'global'],
    queryFn: () => api<{ entries: RankingEntry[] }>('/api/ranking/global'),
    select: (d) => d.entries,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Ranking</h1>
        <p className="text-sm text-muted-foreground">Atualizado ao vivo, gol a gol. ⚡</p>
      </div>

      <Tabs defaultValue="pool">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pool" className="flex-1 sm:flex-none">Por bolão</TabsTrigger>
          <TabsTrigger value="global" className="flex-1 sm:flex-none">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="pool" className="space-y-4">
          {pools.length === 0 ? (
            <EmptyState icon={Medal} title="Sem bolões ainda" description="Entre em um bolão para disputar o ranking." />
          ) : (
            <>
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
              {poolId && <LiveRanking poolId={poolId} highlightUserId={currentUserId} />}
            </>
          )}
        </TabsContent>

        <TabsContent value="global">
          {loadingGlobal ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <RankingTable entries={global ?? []} highlightUserId={currentUserId} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
