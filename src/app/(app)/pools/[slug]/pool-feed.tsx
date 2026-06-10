'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSocketEvent } from '@/hooks/use-socket';
import { FeedPost, type FeedPostDTO } from '@/components/features/feed-post';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface FeedResponse {
  items: FeedPostDTO[];
  nextCursor: string | null;
}

export function PoolFeed({ poolId, currentUserId }: { poolId: string; currentUserId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', poolId],
    queryFn: ({ pageParam }) =>
      api<FeedResponse>(`/api/feed?poolId=${poolId}${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  // feed em tempo real
  useSocketEvent<FeedPostDTO>(
    'feed:new',
    () => void queryClient.invalidateQueries({ queryKey: ['feed', poolId] }),
    [`pool:${poolId}`],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  if (posts.length === 0) {
    return <EmptyState icon={Newspaper} title="Feed vazio" description="Os acontecimentos do bolão aparecem aqui: acertos, zoeiras e conquistas." />;
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <FeedPost key={post.id} post={post} currentUserId={currentUserId} />
      ))}
      {hasNextPage && (
        <Button variant="outline" className="w-full" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}
