'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { api, ClientApiError } from '@/lib/api-client';
import { formatKickoff } from '@/lib/utils';

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

/** Converte moneyline americano para odds decimais (ex.: -120 → 1.83, +380 → 4.80) */
function toDecimal(american: number): string {
  const dec = american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
  return dec.toFixed(2);
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

interface MatchCardProps {
  match: MatchDTO;
  bet?: BetDTO;
  poolId?: string;
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

export function MatchCard({ match, bet, poolId }: MatchCardProps) {
  const queryClient = useQueryClient();
  const [home, setHome] = useState(bet ? String(bet.homeScore) : '');
  const [away, setAway] = useState(bet ? String(bet.awayScore) : '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      {match.status === 'SCHEDULED' && match.oddsHome !== null && match.oddsDraw !== null && match.oddsAway !== null && (
        <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-md bg-secondary/40 py-1.5">
            <span className="font-mono font-bold text-foreground">{toDecimal(match.oddsHome)}</span>
            <span>{match.homeTeam.code}</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-md bg-secondary/40 py-1.5">
            <span className="font-mono font-bold text-foreground">{toDecimal(match.oddsDraw)}</span>
            <span>Empate</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-md bg-secondary/40 py-1.5">
            <span className="font-mono font-bold text-foreground">{toDecimal(match.oddsAway)}</span>
            <span>{match.awayTeam.code}</span>
          </div>
        </div>
      )}

      {bet && match.status === 'LIVE' && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span>Seu palpite:</span>
          <span className="font-semibold text-foreground">
            {bet.homeScore} × {bet.awayScore}
          </span>
        </div>
      )}

      {bet?.status === 'SCORED' && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">
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
    </motion.div>
  );
}
