'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Settings, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { updatePoolRulesSchema } from '@/server/pools/pool.dto';
import { api, ClientApiError } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { PlayerCombobox } from '@/components/ui/player-combobox';
import type { TopScorerPlayer } from '@/lib/top-scorer-players';
import type { z } from 'zod';

export interface PoolRulesInfo {
  id: string;
  name: string;
  description: string | null;
  pointsExactScore: number;
  pointsGoalDiff: number;
  pointsCorrectWinner: number;
  bonusUniqueHit: number;
  bonusTopScorer: number;
  topScorerResult: string | null;
}

const RULE_ROWS: Array<{ key: keyof PoolRulesInfo; emoji: string; label: string; hint: string }> = [
  { key: 'pointsExactScore', emoji: '🎯', label: 'Placar exato', hint: 'Cravou o placar do jogo' },
  { key: 'pointsGoalDiff', emoji: '📐', label: 'Diferença de gols', hint: 'Acertou vencedor e saldo de gols' },
  { key: 'pointsCorrectWinner', emoji: '✅', label: 'Vencedor correto', hint: 'Acertou quem venceu (ou o empate)' },
  { key: 'bonusUniqueHit', emoji: '🏅', label: 'Bônus solitário', hint: 'Único do bolão a acertar (acumula)' },
  { key: 'bonusTopScorer', emoji: '🥅', label: 'Artilheiro do torneio', hint: 'Acertou o artilheiro até 17/06' },
];

/** Regras de pontuação do bolão — visível para todos os membros. */
export function PoolRulesDialog({ pool }: { pool: PoolRulesInfo }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="h-4 w-4" /> Regras
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regras de pontuação</DialogTitle>
          <DialogDescription>Como os pontos são distribuídos em “{pool.name}”.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {RULE_ROWS.map((rule) => (
            <li
              key={rule.key}
              className="flex items-center justify-between gap-3 rounded-md bg-secondary/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{rule.emoji}</span>
                <div>
                  <p className="text-sm font-semibold">{rule.label}</p>
                  <p className="text-xs text-muted-foreground">{rule.hint}</p>
                </div>
              </div>
              <span className="font-display text-lg font-black text-primary">
                {pool[rule.key] as number} pts
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Os bônus somam-se aos pontos da faixa atingida. Palpites travam no horário de início de
          cada partida.
        </p>
      </DialogContent>
    </Dialog>
  );
}

type SettingsInput = z.output<typeof updatePoolRulesSchema>;

/** Edição de nome, descrição e regras — apenas dono/admin do bolão. */
export function PoolSettingsDialog({ pool }: { pool: PoolRulesInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topScorerPlayer, setTopScorerPlayer] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const { data: topScorerData } = useQuery({
    queryKey: ['top-scorer', pool.id],
    queryFn: () => api<{ players: TopScorerPlayer[] }>(`/api/top-scorer?poolId=${pool.id}`),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsInput>({
    resolver: zodResolver(updatePoolRulesSchema),
    defaultValues: {
      name: pool.name,
      description: pool.description ?? '',
      pointsExactScore: pool.pointsExactScore,
      pointsGoalDiff: pool.pointsGoalDiff,
      pointsCorrectWinner: pool.pointsCorrectWinner,
      bonusUniqueHit: pool.bonusUniqueHit,
    },
  });

  async function onSubmit(data: SettingsInput) {
    try {
      await api(`/api/pools/${pool.id}/rules`, { method: 'PATCH', json: data });
      toast.success('Bolão atualizado! ✅');
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Erro ao salvar');
    }
  }

  async function confirmTopScorer() {
    if (!topScorerPlayer) return;
    setIsConfirming(true);
    try {
      const res = await api<{ winners: number; bonus: number }>(
        `/api/pools/${pool.id}/top-scorer-result`,
        { method: 'POST', json: { playerName: topScorerPlayer } },
      );
      toast.success(`Artilheiro confirmado! ${res.winners} participante(s) ganham +${res.bonus} pts 🥅`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Erro ao confirmar');
    } finally {
      setIsConfirming(false);
    }
  }

  const allPlayers = topScorerData?.players ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Configurações do bolão">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do bolão</DialogTitle>
          <DialogDescription>
            Alterações nas regras valem para os jogos pontuados daqui em diante.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pool-name">Nome do bolão</Label>
            <Input id="pool-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-description">Descrição</Label>
            <Input id="pool-description" {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {RULE_ROWS.map((rule) => (
              <div key={rule.key} className="space-y-1.5">
                <Label htmlFor={`rule-${rule.key}`}>
                  {rule.emoji} {rule.label}
                </Label>
                <Input
                  id={`rule-${rule.key}`}
                  type="number"
                  min={0}
                  max={200}
                  {...register(rule.key as 'pointsExactScore', { valueAsNumber: true })}
                />
              </div>
            ))}
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Salvar alterações
          </Button>
        </form>

        {/* Artilheiro do torneio — admin only, one-time action */}
        <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold">Artilheiro do Torneio</p>
          </div>
          {pool.topScorerResult ? (
            <p className="text-sm text-muted-foreground">
              Já confirmado: <strong className="text-foreground">{pool.topScorerResult}</strong>
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Confirme o artilheiro ao fim do torneio. Esta ação distribui os pontos e não pode ser desfeita.
              </p>
              <PlayerCombobox
                players={allPlayers}
                value={topScorerPlayer}
                onChange={setTopScorerPlayer}
                placeholder="Selecione o artilheiro..."
              />
              <Button
                className="w-full bg-amber-500 text-white hover:bg-amber-600"
                disabled={!topScorerPlayer}
                loading={isConfirming}
                onClick={confirmTopScorer}
                type="button"
              >
                Confirmar artilheiro e distribuir pontos
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
