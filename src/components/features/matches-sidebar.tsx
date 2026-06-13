'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckSquare, Trophy, Lightbulb, ArrowRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatKickoff, initials } from '@/lib/utils';
import { getCuriosity } from '@/lib/team-curiosities';
import type { MatchDTO, BetDTO } from '@/components/features/match-card';
import type { RankingEntry } from '@/server/ranking/ranking.service';

const MEDALS = ['🥇', '🥈', '🥉'];

interface MatchesSidebarProps {
  poolId: string | undefined;
  poolName: string | undefined;
}

export function MatchesSidebar({ poolId, poolName }: MatchesSidebarProps) {
  const { data: allMatches } = useQuery({
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

  const { data: ranking } = useQuery({
    queryKey: ['ranking', poolId],
    queryFn: () => api<{ entries: RankingEntry[] }>(`/api/pools/${poolId}/ranking`),
    select: (d) => d.entries.slice(0, 3),
    enabled: Boolean(poolId),
  });

  const now = new Date();

  const openMatches = (allMatches ?? []).filter(
    (m) => m.status === 'SCHEDULED' && new Date(m.kickoffAt) > now,
  );
  const nextMatch = openMatches[0] ?? null;

  const betMatchIds = new Set((bets ?? []).map((b) => b.matchId));
  const betsTotal = (bets ?? []).length;
  const totalOpen = openMatches.length;
  const remaining = openMatches.filter((m) => !betMatchIds.has(m.id)).length;
  const totalBettable = (allMatches ?? []).filter((m) => m.status !== 'POSTPONED').length;
  const progressPct = totalBettable > 0 ? Math.round((betsTotal / totalBettable) * 100) : 0;

  const curiosity = nextMatch
    ? (getCuriosity(nextMatch.homeTeam.code) ?? getCuriosity(nextMatch.awayTeam.code))
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="glass rounded-lg p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CheckSquare className="h-4 w-4 text-primary" />
          Seus Palpites
        </div>
        {!allMatches ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{betsTotal}</span> feitos
              </span>
              {remaining > 0 ? (
                <span>
                  <span className="font-semibold text-amber-500">{remaining}</span> faltando
                </span>
              ) : (
                <span className="font-semibold text-green-500">Todos completos ✓</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Next match */}
      <div className="glass rounded-lg p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Próximo Jogo
        </div>
        {!allMatches ? (
          <Skeleton className="h-16 w-full" />
        ) : nextMatch ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-1 flex-col items-center gap-1">
                <Image
                  src={nextMatch.homeTeam.flagUrl}
                  alt={nextMatch.homeTeam.name}
                  width={36}
                  height={24}
                  className="rounded-sm object-cover"
                />
                <span className="text-xs font-semibold">{nextMatch.homeTeam.code}</span>
              </div>
              <span className="text-xs font-bold text-muted-foreground">vs</span>
              <div className="flex flex-1 flex-col items-center gap-1">
                <Image
                  src={nextMatch.awayTeam.flagUrl}
                  alt={nextMatch.awayTeam.name}
                  width={36}
                  height={24}
                  className="rounded-sm object-cover"
                />
                <span className="text-xs font-semibold">{nextMatch.awayTeam.code}</span>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {nextMatch.groupName ? `Grupo ${nextMatch.groupName} · ` : ''}
              {formatKickoff(nextMatch.kickoffAt)}
            </p>
          </>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Nenhum jogo agendado</p>
        )}
      </div>

      {/* Mini ranking */}
      {poolId && (
        <div className="glass rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-primary" />
            {poolName ?? 'Ranking'}
          </div>
          {!ranking ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : ranking.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">Ainda sem pontuação</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((entry) => (
                <div key={entry.userId} className="flex items-center gap-2">
                  <span className="w-5 text-center text-sm">
                    {MEDALS[entry.currentRank - 1] ?? entry.currentRank}
                  </span>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={entry.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">{initials(entry.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{entry.name}</span>
                  <span className="text-xs font-black tabular-nums">{entry.totalPoints} pts</span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/ranking"
            className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver ranking completo <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Curiosity */}
      {curiosity && (
        <div className="glass rounded-lg p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Você sabia?
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{curiosity}</p>
        </div>
      )}
    </div>
  );
}
