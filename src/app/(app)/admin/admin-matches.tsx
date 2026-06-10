'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, ClientApiError } from '@/lib/api-client';
import { formatKickoff } from '@/lib/utils';
import type { MatchDTO } from '@/components/features/match-card';

export function AdminMatches({ matches }: { matches: MatchDTO[] }) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function setScore(matchId: string, side: 'home' | 'away', value: string) {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        home: side === 'home' ? value.replace(/\D/g, '').slice(0, 2) : (prev[matchId]?.home ?? ''),
        away: side === 'away' ? value.replace(/\D/g, '').slice(0, 2) : (prev[matchId]?.away ?? ''),
      },
    }));
  }

  async function submit(matchId: string) {
    const score = scores[matchId];
    if (!score || score.home === '' || score.away === '') return;
    setSaving(matchId);
    try {
      await api(`/api/admin/matches/${matchId}/result`, {
        method: 'POST',
        json: { homeScore: Number(score.home), awayScore: Number(score.away), status: 'FINISHED' },
      });
      toast.success('Resultado processado! Pontos distribuídos ⚡');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Erro ao salvar resultado');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const finished = match.status === 'FINISHED';
        return (
          <div key={match.id} className="glass flex flex-wrap items-center gap-3 rounded-lg p-3">
            <span className="w-32 text-xs text-muted-foreground">
              {match.groupName ? `Grupo ${match.groupName}` : match.stage} ·{' '}
              {formatKickoff(match.kickoffAt)}
            </span>
            <div className="flex flex-1 items-center justify-center gap-2 text-sm font-semibold">
              <span className="flex items-center gap-1.5">
                <Image src={match.homeTeam.flagUrl} alt="" width={24} height={16} className="rounded-sm" />
                {match.homeTeam.code}
              </span>
              {finished ? (
                <Badge variant="secondary">
                  {match.homeScore} × {match.awayScore}
                </Badge>
              ) : (
                <span className="flex items-center gap-1">
                  <input
                    className="h-9 w-10 rounded-md border border-input bg-secondary/60 text-center font-bold focus:border-primary focus:outline-none"
                    value={scores[match.id]?.home ?? ''}
                    onChange={(e) => setScore(match.id, 'home', e.target.value)}
                    inputMode="numeric"
                  />
                  ×
                  <input
                    className="h-9 w-10 rounded-md border border-input bg-secondary/60 text-center font-bold focus:border-primary focus:outline-none"
                    value={scores[match.id]?.away ?? ''}
                    onChange={(e) => setScore(match.id, 'away', e.target.value)}
                    inputMode="numeric"
                  />
                </span>
              )}
              <span className="flex items-center gap-1.5">
                {match.awayTeam.code}
                <Image src={match.awayTeam.flagUrl} alt="" width={24} height={16} className="rounded-sm" />
              </span>
            </div>
            {!finished && (
              <Button
                size="sm"
                loading={saving === match.id}
                disabled={!scores[match.id]?.home || !scores[match.id]?.away}
                onClick={() => submit(match.id)}
              >
                Encerrar jogo
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
