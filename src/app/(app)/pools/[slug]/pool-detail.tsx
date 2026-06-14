'use client';

import { useState } from 'react';
import { Copy, Share2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LiveRanking } from '@/components/features/live-ranking';
import { PoolFeed } from './pool-feed';
import { PoolRulesDialog, PoolSettingsDialog } from './pool-settings';
import { PoolBets } from './pool-bets';

interface PoolDetailProps {
  pool: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    inviteCode: string;
    _count: { members: number };
    pointsExactScore: number;
    pointsGoalDiff: number;
    pointsCorrectWinner: number;
    bonusUnderdog: number;
    bonusUniqueHit: number;
  };
  currentUserId: string;
  isAdmin: boolean;
}

export function PoolDetail({ pool, currentUserId, isAdmin }: PoolDetailProps) {
  const [tab, setTab] = useState('ranking');

  async function copyInvite() {
    const text = `⚽ Entre no meu bolão "${pool.name}" no Bolão 2026!\nCódigo: ${pool.inviteCode}\n${window.location.origin}/pools`;
    await navigator.clipboard.writeText(text);
    toast.success('Convite copiado! Cole no grupo do WhatsApp 📋');
  }

  async function shareRanking() {
    const url = `${window.location.origin}/api/share/${pool.id}`;
    if (navigator.share) {
      await navigator.share({ title: `Ranking — ${pool.name}`, url }).catch(() => undefined);
    } else {
      window.open(url, '_blank');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{pool.name}</h1>
          {pool.description && <p className="text-sm text-muted-foreground">{pool.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">
              <Users className="h-3 w-3" /> {pool._count.members}
            </Badge>
            <Badge>🎯 {pool.pointsExactScore} pts placar exato</Badge>
            <Badge variant="secondary">✅ {pool.pointsCorrectWinner} pts vencedor</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyInvite}>
            <Copy className="h-4 w-4" /> {pool.inviteCode}
          </Button>
          <Button variant="outline" size="sm" onClick={shareRanking}>
            <Share2 className="h-4 w-4" />
          </Button>
          <PoolRulesDialog pool={pool} />
          {isAdmin && <PoolSettingsDialog pool={pool} />}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="ranking" className="flex-1 sm:flex-none">Ranking</TabsTrigger>
          <TabsTrigger value="bets" className="flex-1 sm:flex-none">Palpites</TabsTrigger>
          <TabsTrigger value="feed" className="flex-1 sm:flex-none">Feed</TabsTrigger>
        </TabsList>
        <TabsContent value="ranking">
          <LiveRanking poolId={pool.id} highlightUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="bets">
          <PoolBets poolId={pool.id} currentUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="feed">
          <PoolFeed poolId={pool.id} currentUserId={currentUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
