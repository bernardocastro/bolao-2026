'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Check, ChevronDown, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ClientApiError } from '@/lib/api-client';
import { formatKickoff, initials, cn } from '@/lib/utils';

const DEBOUNCE_MS = 800;

export interface MatchDTO {
  id: string;
  stage: string;
  round: number;
  groupName: string | null;
  kickoffAt: string;
  venue: string | null;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: string; name: string; code: string; flagUrl: string };
  awayTeam: { id: string; name: string; code: string; flagUrl: string };
  oddsHome: number | null;
  oddsDraw: number | null;
  oddsAway: number | null;
}

function impliedProb(american: number): number {
  return american > 0
    ? 100 / (american + 100)
    : Math.abs(american) / (Math.abs(american) + 100);
}

function toPcts(home: number, draw: number, away: number): [number, number, number] {
  const h = impliedProb(home);
  const d = impliedProb(draw);
  const a = impliedProb(away);
  const total = h + d + a;
  const pH = Math.round((h / total) * 100);
  const pD = Math.round((d / total) * 100);
  return [pH, pD, 100 - pH - pD];
}

const AZARAO_THRESHOLD = 150; // moneyline >= +150 = azarão

export interface BetDTO {
  matchId: string;
  homeScore: number;
  awayScore: number;
  pointsEarned: number;
  status: 'PENDING' | 'SCORED';
  isExactScore: boolean;
  isCorrectWinner: boolean;
}

export interface MatchBetEntry {
  matchId: string;
  homeScore: number;
  awayScore: number;
  pointsEarned: number;
  status: 'PENDING' | 'SCORED';
  isExactScore: boolean;
  isCorrectWinner: boolean;
  user: { id: string; name: string; username: string; avatarUrl: string | null };
}

interface MatchCardProps {
  match: MatchDTO;
  bet?: BetDTO;
  poolId?: string;
  currentUserId?: string;
}

function MatchBetsList({
  matchId,
  poolId,
  currentUserId,
}: {
  matchId: string;
  poolId: string;
  currentUserId?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['match-bets', matchId, poolId],
    queryFn: () =>
      api<{ bets: MatchBetEntry[] }>(`/api/matches/${matchId}/bets?poolId=${poolId}`),
    select: (d) => d.bets,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mt-2 space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Nenhum palpite registrado.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      {data.map((entry) => {
        const isMe = entry.user.id === currentUserId;
        return (
          <div
            key={entry.user.id}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
              isMe ? 'bg-primary/10' : 'bg-secondary/30',
            )}
          >
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarImage src={entry.user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-[9px]">{initials(entry.user.name)}</AvatarFallback>
            </Avatar>
            <span className={cn('min-w-0 flex-1 truncate font-medium', isMe && 'text-primary')}>
              {isMe ? 'Você' : entry.user.name}
            </span>
            <span className="shrink-0 font-black tabular-nums">
              {entry.homeScore} × {entry.awayScore}
            </span>
            {entry.status === 'SCORED' && (
              <Badge
                variant={
                  entry.pointsEarned > 0
                    ? entry.isExactScore
                      ? 'gold'
                      : 'default'
                    : 'secondary'
                }
                className="shrink-0 text-[10px]"
              >
                {entry.isExactScore && '🎯 '}+{entry.pointsEarned}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      aria-label={label}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
      className="h-12 w-12 rounded-md border border-input bg-secondary/60 text-center text-lg font-bold transition-colors focus:border-primary focus:outline-none disabled:opacity-50"
    />
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function MatchCard({ match, bet, poolId, currentUserId }: MatchCardProps) {
  const queryClient = useQueryClient();
  const [home, setHome] = useState(bet ? String(bet.homeScore) : '');
  const [away, setAway] = useState(bet ? String(bet.awayScore) : '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showBets, setShowBets] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kickoffPassed = new Date(match.kickoffAt) <= new Date();
  const canReveal = poolId && kickoffPassed && match.status !== 'SCHEDULED' && match.status !== 'POSTPONED';

  const locked = match.status !== 'SCHEDULED' || new Date(match.kickoffAt) <= new Date();
  const dirty = home !== (bet ? String(bet.homeScore) : '') || away !== (bet ? String(bet.awayScore) : '');

  const save = useMutation({
    mutationFn: () =>
      api('/api/bets', {
        method: 'PUT',
        json: { poolId, matchId: match.id, homeScore: Number(home), awayScore: Number(away) },
      }),
    onSuccess: () => {
      setSaveStatus('saved');
      void queryClient.invalidateQueries({ queryKey: ['bets', poolId] });
      timerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (error) => {
      setSaveStatus('idle');
      toast.error(error instanceof ClientApiError ? error.message : 'Erro ao salvar palpite');
    },
  });

  useEffect(() => {
    if (locked || !poolId || !dirty || home === '' || away === '') return;
    setSaveStatus('idle');
    timerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      save.mutate();
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-lg p-4"
    >
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {match.groupName ? `Grupo ${match.groupName} · ` : ''}
          {formatKickoff(match.kickoffAt)}
        </span>
        {match.status === 'LIVE' && <Badge variant="live">● AO VIVO</Badge>}
        {match.status === 'FINISHED' && <Badge variant="secondary">Encerrado</Badge>}
        {locked && match.status === 'SCHEDULED' && (
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" /> Fechado
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-end gap-1">
          <div className="flex items-center justify-end gap-2">
            <div className="flex flex-col items-end gap-0.5 text-right">
              <span className="hidden text-sm font-semibold sm:block">{match.homeTeam.name}</span>
              <span className="text-sm font-semibold sm:hidden">{match.homeTeam.code}</span>
              {match.oddsHome !== null && match.oddsHome >= AZARAO_THRESHOLD && (
                <Badge variant="outline" className="w-fit max-w-[4rem] border-amber-500/50 px-1.5 py-0 text-[10px] text-amber-500">
                  Azarão
                </Badge>
              )}
            </div>
            <Image
              src={match.homeTeam.flagUrl}
              alt={match.homeTeam.name}
              width={32}
              height={22}
              className="rounded-sm object-cover"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-1">
          {match.status !== 'SCHEDULED' ? (
            <div className="flex items-center gap-2 text-xl font-black">
              <span>{match.homeScore ?? '-'}</span>
              <span className="text-muted-foreground">:</span>
              <span>{match.awayScore ?? '-'}</span>
            </div>
          ) : poolId ? (
            <>
              <ScoreInput value={home} onChange={setHome} disabled={locked} label="Gols do mandante" />
              <span className="text-muted-foreground">×</span>
              <ScoreInput value={away} onChange={setAway} disabled={locked} label="Gols do visitante" />
            </>
          ) : (
            <span className="px-3 text-lg font-bold text-muted-foreground">vs</span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <Image
              src={match.awayTeam.flagUrl}
              alt={match.awayTeam.name}
              width={32}
              height={22}
              className="rounded-sm object-cover"
            />
            <div className="flex flex-col gap-0.5">
              <span className="hidden text-sm font-semibold sm:block">{match.awayTeam.name}</span>
              <span className="text-sm font-semibold sm:hidden">{match.awayTeam.code}</span>
              {match.oddsAway !== null && match.oddsAway >= AZARAO_THRESHOLD && (
                <Badge variant="outline" className="w-fit max-w-[4rem] border-amber-500/50 px-1.5 py-0 text-[10px] text-amber-500">
                  Azarão
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {match.status === 'SCHEDULED' && match.oddsHome !== null && match.oddsDraw !== null && match.oddsAway !== null && (() => {
        const [pH, pD, pA] = toPcts(match.oddsHome, match.oddsDraw, match.oddsAway);
        return (
          <div className="mt-3 space-y-1.5">
            <div className="flex h-2 overflow-hidden rounded-full">
              <div className="bg-primary transition-all" style={{ width: `${pH}%` }} />
              <div className="bg-amber-500/70 transition-all" style={{ width: `${pD}%` }} />
              <div className="bg-sky-500 transition-all" style={{ width: `${pA}%` }} />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="font-semibold text-primary">{match.homeTeam.code} {pH}%</span>
              <span className="text-amber-500/80">Empate {pD}%</span>
              <span className="font-semibold text-sky-400">{pA}% {match.awayTeam.code}</span>
            </div>
          </div>
        );
      })()}

      {bet && match.status === 'LIVE' && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-primary">
          <span>Seu palpite:</span>
          <span className="font-semibold">
            {bet.homeScore} × {bet.awayScore}
          </span>
        </div>
      )}

      {bet?.status === 'SCORED' && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <span className="text-primary">
            Seu palpite: {bet.homeScore}×{bet.awayScore}
          </span>
          <Badge variant={bet.pointsEarned > 0 ? (bet.isExactScore ? 'gold' : 'default') : 'secondary'}>
            {bet.isExactScore && '🎯 '}+{bet.pointsEarned} pts
          </Badge>
        </div>
      )}

      <AnimatePresence>
        {saveStatus !== 'idle' && (
          <motion.div
            key={saveStatus}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex items-center justify-center gap-1.5 text-xs"
          >
            {saveStatus === 'saving' ? (
              <span className="text-muted-foreground">Salvando…</span>
            ) : (
              <span className="flex items-center gap-1 text-green-500">
                <Check className="h-3 w-3" /> Salvo
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {canReveal && (
        <div className="mt-3 border-t border-border/40 pt-3">
          <button
            onClick={() => setShowBets((v) => !v)}
            className="flex w-full items-center justify-between text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Palpites dos participantes
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', showBets && 'rotate-180')}
            />
          </button>
          <AnimatePresence>
            {showBets && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <MatchBetsList
                  matchId={match.id}
                  poolId={poolId}
                  currentUserId={currentUserId}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
