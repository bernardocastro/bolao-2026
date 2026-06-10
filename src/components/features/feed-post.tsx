'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Share2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api-client';
import { timeAgo, initials, cn } from '@/lib/utils';

const EMOJIS = ['🔥', '⚽', '😂', '👏', '❤️', '😱'] as const;

export interface FeedPostDTO {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  actor: { id: string; name: string; username: string; avatarUrl: string | null } | null;
  pool?: { id: string; name: string; slug: string };
  reactions: Array<{ emoji: string; userId: string }>;
  _count: { comments: number; reactions: number };
}

interface CommentDTO {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; username: string; avatarUrl: string | null };
}

export function FeedPost({ post, currentUserId }: { post: FeedPostDTO; currentUserId?: string }) {
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');

  const { data: comments } = useQuery({
    queryKey: ['comments', post.id],
    queryFn: () => api<{ comments: CommentDTO[] }>(`/api/feed/${post.id}/comments`),
    enabled: showComments,
    select: (d) => d.comments,
  });

  const react = useMutation({
    mutationFn: (emoji: string) =>
      api(`/api/feed/${post.id}/reactions`, { method: 'POST', json: { emoji } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  const addComment = useMutation({
    mutationFn: () =>
      api(`/api/feed/${post.id}/comments`, { method: 'POST', json: { content: comment } }),
    onSuccess: () => {
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const reactionCounts = post.reactions.reduce<Record<string, { count: number; mine: boolean }>>(
    (acc, r) => {
      acc[r.emoji] ??= { count: 0, mine: false };
      acc[r.emoji]!.count++;
      if (r.userId === currentUserId) acc[r.emoji]!.mine = true;
      return acc;
    },
    {},
  );

  async function share() {
    const text = `${post.content} — Bolão 2026 🏆`;
    if (navigator.share) {
      await navigator.share({ text }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado! Cole no WhatsApp 📋');
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-lg p-4"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.actor?.avatarUrl ?? undefined} alt={post.actor?.name ?? 'Sistema'} />
          <AvatarFallback>{post.actor ? initials(post.actor.name) : '⚽'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">{post.actor?.name ?? 'Bolão 2026'}</span>{' '}
            <span className="text-xs text-muted-foreground">
              {post.pool ? `em ${post.pool.name} · ` : ''}
              {timeAgo(post.createdAt)}
            </span>
          </p>
          <p className="mt-1 text-sm leading-relaxed">{post.content}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {EMOJIS.map((emoji) => {
          const r = reactionCounts[emoji];
          return (
            <button
              key={emoji}
              onClick={() => react.mutate(emoji)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-sm transition-all hover:scale-110 active:scale-95',
                r?.mine ? 'border-primary/50 bg-primary/15' : 'border-border bg-secondary/40',
              )}
            >
              {emoji} {r && r.count > 0 && <span className="text-xs font-semibold">{r.count}</span>}
            </button>
          );
        })}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)}>
          <MessageCircle className="h-4 w-4" /> {post._count.comments}
        </Button>
        <Button variant="ghost" size="sm" onClick={share}>
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {showComments && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 space-y-3 border-t border-border/60 pt-3">
          {(comments ?? []).map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={c.author.avatarUrl ?? undefined} alt={c.author.name} />
                <AvatarFallback>{initials(c.author.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-md bg-secondary/50 px-3 py-2">
                <p className="text-xs font-semibold">
                  {c.author.name} <span className="font-normal text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="text-sm">{c.content}</p>
              </div>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (comment.trim()) addComment.mutate();
            }}
            className="flex gap-2"
          >
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentar..."
              maxLength={500}
            />
            <Button type="submit" size="sm" loading={addComment.isPending} disabled={!comment.trim()}>
              Enviar
            </Button>
          </form>
        </motion.div>
      )}
    </motion.article>
  );
}
