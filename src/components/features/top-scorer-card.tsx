'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, ClientApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { TOP_SCORER_DEADLINE, type TopScorerPlayer } from '@/lib/top-scorer-players';
import { cn } from '@/lib/utils';

interface TopScorerData {
  players: TopScorerPlayer[];
  pick: string | null;
  result: string | null;
  bonus: number;
  closed: boolean;
}

interface TopScorerCardProps {
  poolId: string;
}

function useDeadlineLabel() {
  const now = new Date();
  const diff = TOP_SCORER_DEADLINE.getTime() - now.getTime();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Menos de 1 hora restante';
  if (hours < 24) return `${hours}h restantes`;
  const days = Math.floor(hours / 24);
  return `${days} dia${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
}

export function TopScorerCard({ poolId }: TopScorerCardProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>('');
  const [search, setSearch] = useState('');
  const deadlineLabel = useDeadlineLabel();

  const { data, isLoading } = useQuery({
    queryKey: ['top-scorer', poolId],
    queryFn: () => api<TopScorerData>(`/api/top-scorer?poolId=${poolId}`),
  });

  useEffect(() => {
    if (data?.pick && !selected) setSelected(data.pick);
  }, [data?.pick]);

  const { mutate: savePick, isPending: isSaving } = useMutation({
    mutationFn: () => api('/api/top-scorer', { method: 'POST', json: { poolId, playerName: selected } }),
    onSuccess: () => {
      toast.success('Palpite do artilheiro salvo! 🥅');
      qc.invalidateQueries({ queryKey: ['top-scorer', poolId] });
    },
    onError: (e) => {
      toast.error(e instanceof ClientApiError ? e.message : 'Erro ao salvar');
    },
  });

  if (isLoading || !data) return null;

  const { players, pick, result, bonus, closed } = data;

  const filteredPlayers =
    search.length >= 2
      ? players.filter(
          (p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.country.toLowerCase().includes(search.toLowerCase()),
        )
      : players;

  const byCountry = filteredPlayers.reduce<Record<string, TopScorerPlayer[]>>((acc, p) => {
    (acc[p.country] ??= []).push(p);
    return acc;
  }, {});

  const isCorrect = result && pick === result;
  const isWrong = result && pick && pick !== result;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-2 p-4',
        result
          ? isCorrect
            ? 'border-green-500/50 bg-green-500/5'
            : 'border-border bg-card'
          : 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
          <Trophy className="h-4 w-4 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Artilheiro do Torneio</p>
          <p className="text-xs text-muted-foreground">+{bonus} pts para quem acertar</p>
        </div>
        {closed && !result && (
          <Lock className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Result announced */}
      {result ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
            <span className="text-sm font-semibold">{result}</span>
            <span className="ml-auto text-xs text-muted-foreground">Artilheiro oficial</span>
          </div>
          {pick && (
            <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', isCorrect ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-secondary/40 text-muted-foreground')}>
              {isCorrect ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              {isCorrect ? (
                <span>Você acertou! <strong>+{bonus} pts</strong></span>
              ) : (
                <span>Seu palpite: <strong>{pick}</strong></span>
              )}
            </div>
          )}
          {!pick && (
            <p className="text-xs text-muted-foreground">Você não enviou um palpite.</p>
          )}
          {isWrong && (
            <p className="text-xs text-muted-foreground">Não foi dessa vez. 😅</p>
          )}
        </div>
      ) : closed ? (
        /* Deadline passed, no result yet */
        <div className="space-y-2">
          <div className="rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="mr-1.5 inline h-3.5 w-3.5" />
            Prazo encerrado em 17/06. Aguardando o fim do torneio.
          </div>
          {pick ? (
            <p className="text-xs text-muted-foreground">
              Seu palpite: <strong className="text-foreground">{pick}</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Você não enviou um palpite.</p>
          )}
        </div>
      ) : (
        /* Open — show selector */
        <div className="space-y-3">
          {deadlineLabel && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              ⏰ {deadlineLabel} · prazo: 17/06
            </p>
          )}
          <input
            type="text"
            placeholder="Buscar jogador ou seleção..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            size={5}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="">— selecione —</option>
            {Object.entries(byCountry).map(([country, countryPlayers]) => (
              <optgroup key={country} label={country}>
                {countryPlayers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button
            size="sm"
            className="w-full bg-amber-500 text-white hover:bg-amber-600"
            disabled={!selected || selected === pick}
            loading={isSaving}
            onClick={() => savePick()}
          >
            {pick ? 'Atualizar palpite' : 'Salvar palpite'}
          </Button>
          {pick && (
            <p className="text-center text-xs text-muted-foreground">
              Palpite atual: <strong className="text-foreground">{pick}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
