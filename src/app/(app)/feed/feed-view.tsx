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

export function FeedView({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', 'all'],
    queryFn: ({ pageParam }) => api<FeedResponse>(`/api/feed${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  useSocketEvent<FeedPostDTO>('feed:new', () => {
    void queryClient.invalidateQueries({ queryKey: ['feed'] });
  });

  const posts = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Feed</h1>
        <p className="text-sm text-muted-foreground">Tudo que rola nos seus bolões, em tempo real.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Nada por aqui ainda"
          description="Quando os jogos começarem, os acertos (e as mancadas) dos seus amigos aparecem aqui."
        />
      ) : (
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
      )}
    </div>
  );
}
