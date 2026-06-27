'use client';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKickoff, cn } from '@/lib/utils';
import type { MatchDTO, BetDTO } from '@/components/features/match-card';

const STAGE_ORDER = [
  'ROUND_OF_32',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'THIRD_PLACE',
  'FINAL',
];

const STAGE_LABELS: Record<string, string> = {
  ROUND_OF_32: 'Oitavas de final',
  ROUND_OF_16: 'Quartas de final',
  QUARTER_FINAL: 'Semifinal',
  SEMI_FINAL: 'Semifinal',
  THIRD_PLACE: '3º lugar',
  FINAL: 'Final',
};

function placeholderLabel(code: string | null | undefined): string {
  if (!code) return 'A definir';
  const pos = code[0];
  const group = code.slice(1);
  if (pos === '1' && group) return `1º Gr. ${group}`;
  if (pos === '2' && group) return `2º Gr. ${group}`;
  if (code === '3RD') return '3º melhor';
  if (code.startsWith('RD') || code.startsWith('QF') || code.startsWith('SF')) return 'A definir';
  return code;
}

interface KnockoutMatchCardProps {
  match: MatchDTO;
  bet?: BetDTO;
}

function KnockoutMatchCard({ match, bet }: KnockoutMatchCardProps) {
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE';
  const hasBet = Boolean(bet);

  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  function TeamRow({
    team,
    placeholder,
    score,
    isWinner,
  }: {
    team: MatchDTO['homeTeam'];
    placeholder?: string | null;
    score: number | null;
    isWinner: boolean;
  }) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2', isFinished && isWinner && 'bg-primary/8')}>
        {team ? (
          <Image
            src={team.flagUrl}
            alt={team.code}
            width={20}
            height={14}
            className="shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="h-3.5 w-5 shrink-0 rounded-sm bg-muted" />
        )}
        <span
          className={cn(
            'flex-1 truncate text-sm',
            isFinished && isWinner ? 'font-bold text-foreground' : 'text-muted-foreground',
            !isFinished && team && 'text-foreground font-medium',
          )}
        >
          {team ? team.code : placeholderLabel(placeholder)}
        </span>
        {(isLive || isFinished) && (
          <span className={cn('shrink-0 text-sm font-black tabular-nums', isFinished && isWinner && 'text-primary')}>
            {score ?? '-'}
          </span>
        )}
      </div>
    );
  }

  const homeWins =
    isFinished &&
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.homeScore > match.awayScore;
  const awayWins =
    isFinished &&
    match.homeScore !== null &&
    match.awayScore !== null &&
    match.awayScore > match.homeScore;

  return (
    <div className={cn('overflow-hidden rounded-lg border', isLive ? 'border-primary/50' : 'border-border')}>
      {/* Date + status */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-1.5">
        <span className="text-[11px] text-muted-foreground">{formatKickoff(match.kickoffAt)}</span>
        <div className="flex items-center gap-1.5">
          {hasBet && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              Palpite: {bet!.homeScore}×{bet!.awayScore}
              {bet!.status === 'SCORED' && bet!.pointsEarned > 0 && ` · +${bet!.pointsEarned}pts`}
            </Badge>
          )}
          {isLive && <Badge variant="live" className="px-1.5 py-0 text-[10px]">● AO VIVO</Badge>}
          {isFinished && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Encerrado</Badge>}
        </div>
      </div>

      {/* Teams */}
      <div className="divide-y divide-border/60">
        <TeamRow team={homeTeam} placeholder={match.homePlaceholder} score={match.homeScore} isWinner={homeWins} />
        <TeamRow team={awayTeam} placeholder={match.awayPlaceholder} score={match.awayScore} isWinner={awayWins} />
      </div>
    </div>
  );
}

interface KnockoutViewProps {
  poolId?: string;
}

export function KnockoutView({ poolId }: KnockoutViewProps) {
  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches', 'knockout'],
    queryFn: () => api<{ matches: MatchDTO[] }>('/api/matches?knockout=true'),
    select: (d) => d.matches,
  });

  const { data: bets } = useQuery({
    queryKey: ['bets', poolId],
    queryFn: () => api<{ bets: BetDTO[] }>(`/api/bets?poolId=${poolId}`),
    select: (d) => d.bets,
    enabled: Boolean(poolId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-24 w-full" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!matches?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <Trophy className="h-10 w-10 opacity-30" />
        <p className="text-sm">As partidas do mata-mata ainda não foram definidas.</p>
        <p className="text-xs">Disponíveis a partir de 28 de junho.</p>
      </div>
    );
  }

  const betByMatch = new Map((bets ?? []).map((b) => [b.matchId, b]));

  // Group by stage in correct order
  const byStage = new Map<string, MatchDTO[]>();
  for (const m of matches) {
    const arr = byStage.get(m.stage) ?? [];
    arr.push(m);
    byStage.set(m.stage, arr);
  }

  const stages = STAGE_ORDER.filter((s) => byStage.has(s));

  return (
    <div className="space-y-8">
      {stages.map((stage) => {
        const stageMatches = byStage.get(stage)!;
        const label = STAGE_LABELS[stage] ?? stage;
        const isDecidingStage = stage === 'FINAL' || stage === 'THIRD_PLACE';

        return (
          <div key={stage}>
            <div className="mb-3 flex items-center gap-2">
              {isDecidingStage && <Trophy className="h-4 w-4 text-amber-500" />}
              <h3 className={cn('font-display text-base font-bold', isDecidingStage && 'text-amber-500')}>
                {label}
              </h3>
              <span className="text-xs text-muted-foreground">
                ({stageMatches.filter((m) => m.status === 'FINISHED').length}/{stageMatches.length})
              </span>
            </div>

            <div className={cn(
              'grid gap-3',
              stage === 'ROUND_OF_32' ? 'sm:grid-cols-2 lg:grid-cols-4' :
              stage === 'ROUND_OF_16' ? 'sm:grid-cols-2 lg:grid-cols-3' :
              stage === 'QUARTER_FINAL' ? 'sm:grid-cols-2' :
              'sm:grid-cols-2',
            )}>
              {stageMatches.map((match) => (
                <KnockoutMatchCard
                  key={match.id}
                  match={match}
                  bet={betByMatch.get(match.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
