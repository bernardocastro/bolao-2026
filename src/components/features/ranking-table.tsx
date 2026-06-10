'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatPoints, initials, cn } from '@/lib/utils';
import type { RankingEntry } from '@/server/ranking/ranking.service';

const MEDALS = ['🥇', '🥈', '🥉'];

function RankDelta({ entry }: { entry: RankingEntry }) {
  if (entry.previousRank === null || entry.previousRank === entry.currentRank) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (entry.currentRank < entry.previousRank) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
        {entry.previousRank - entry.currentRank}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-destructive">
      <TrendingDown className="h-3.5 w-3.5" />
      {entry.currentRank - entry.previousRank}
    </span>
  );
}

export function RankingTable({ entries, highlightUserId }: { entries: RankingEntry[]; highlightUserId?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry.userId}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className={cn(
              'flex items-center gap-3 border-b border-border/60 bg-card px-4 py-3 last:border-0',
              entry.userId === highlightUserId && 'bg-primary/5',
              entry.currentRank <= 3 && 'bg-gradient-to-r from-primary/5 to-transparent',
            )}
          >
            <span className="w-8 text-center text-sm font-bold">
              {MEDALS[entry.currentRank - 1] ?? entry.currentRank}
            </span>
            <RankDelta entry={entry} />
            <Avatar className="h-9 w-9">
              <AvatarImage src={entry.avatarUrl ?? undefined} alt={entry.name} />
              <AvatarFallback>{initials(entry.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {entry.name}
                {entry.streak >= 3 && (
                  <span className="flex items-center text-xs text-gold" title={`${entry.streak} acertos seguidos`}>
                    <Flame className="h-3.5 w-3.5" />
                    {entry.streak}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{entry.username} · {entry.exactScores} placares exatos
              </p>
            </div>
            <motion.span
              key={entry.totalPoints}
              initial={{ scale: 1.3, color: 'hsl(145 80% 50%)' }}
              animate={{ scale: 1, color: 'hsl(150 10% 96%)' }}
              className="text-base font-black tabular-nums"
            >
              {formatPoints(entry.totalPoints)}
            </motion.span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
