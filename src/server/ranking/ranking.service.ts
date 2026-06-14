import { prisma } from '@/lib/prisma';
import { cached, invalidate, publishRealtime, CHANNELS } from '@/lib/redis';
import { feedService } from '@/server/feed/feed.service';
import { notificationService } from '@/server/notifications/notification.service';

export interface RankingEntry {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  totalPoints: number;
  exactScores: number;
  correctWinners: number;
  currentRank: number;
  previousRank: number | null;
  streak: number;
}

export const rankingService = {
  /** Ranking de um bolão (cache Redis 30s). */
  async forPool(poolId: string): Promise<RankingEntry[]> {
    return cached(`ranking:${poolId}`, 30, async () => {
      const members = await prisma.poolMember.findMany({
        where: { poolId },
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        orderBy: [{ totalPoints: 'desc' }, { exactScores: 'desc' }, { joinedAt: 'asc' }],
      });
      return members.map((m, i) => ({
        userId: m.userId,
        name: m.user.name,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        totalPoints: m.totalPoints,
        exactScores: m.exactScores,
        correctWinners: m.correctWinners,
        currentRank: i + 1,
        previousRank: m.previousRank,
        streak: m.streak,
      }));
    });
  },

  /** Ranking global — posição determinada pelo melhor bolão de cada participante. */
  async global(limit = 50): Promise<RankingEntry[]> {
    return cached('ranking:global', 60, async () => {
      const allMembers = await prisma.poolMember.findMany({
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      });

      // Mantém apenas o melhor bolão por usuário
      const bestByUser = new Map<string, (typeof allMembers)[number]>();
      for (const m of allMembers) {
        const current = bestByUser.get(m.userId);
        if (!current || m.totalPoints > current.totalPoints ||
           (m.totalPoints === current.totalPoints && m.exactScores > current.exactScores)) {
          bestByUser.set(m.userId, m);
        }
      }

      const sorted = [...bestByUser.values()]
        .sort((a, b) =>
          b.totalPoints - a.totalPoints ||
          b.exactScores - a.exactScores ||
          a.joinedAt.getTime() - b.joinedAt.getTime(),
        )
        .slice(0, limit);

      return sorted.map((m, i) => ({
        userId: m.userId,
        name: m.user.name,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        totalPoints: m.totalPoints,
        exactScores: m.exactScores,
        correctWinners: m.correctWinners,
        currentRank: i + 1,
        previousRank: null,
        streak: 0,
      }));
    });
  },

  /** Histórico de pontuação por rodada (evolução). */
  async history(poolId: string, userId: string) {
    return prisma.rankingSnapshot.findMany({
      where: { poolId, userId },
      orderBy: { round: 'asc' },
      select: { round: true, points: true, rank: true },
    });
  },

  /**
   * Recalcula posições após uma partida, grava snapshot, detecta
   * subidas/quedas e publica ranking ao vivo via Socket.IO.
   */
  async recompute(poolId: string, ctx?: { matchLabel?: string }): Promise<void> {
    const members = await prisma.poolMember.findMany({
      where: { poolId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ totalPoints: 'desc' }, { exactScores: 'desc' }, { joinedAt: 'asc' }],
    });

    const round = (await prisma.match.count({ where: { scoredAt: { not: null } } })) || 1;

    for (let i = 0; i < members.length; i++) {
      const m = members[i]!;
      const newRank = i + 1;
      const oldRank = m.currentRank;

      await prisma.poolMember.update({
        where: { id: m.id },
        data: { previousRank: oldRank, currentRank: newRank },
      });
      await prisma.rankingSnapshot.upsert({
        where: { poolId_userId_round: { poolId, userId: m.userId, round } },
        create: { poolId, userId: m.userId, round, points: m.totalPoints, rank: newRank },
        update: { points: m.totalPoints, rank: newRank },
      });

      if (oldRank !== null && newRank < oldRank) {
        if (newRank <= 3) {
          await feedService.publish({
            type: 'RANK_UP',
            poolId,
            actorId: m.userId,
            content: `📈 ${m.user.name} subiu para o top ${newRank}!`,
            metadata: { rankFrom: oldRank, rankTo: newRank },
          });
        }
        await notificationService.notify({
          userId: m.userId,
          type: 'RANK_CHANGE',
          title: `Você subiu para ${newRank}º lugar! 🚀`,
          body: ctx?.matchLabel ? `Após ${ctx.matchLabel}` : 'Continue assim!',
          link: '/ranking',
        });
      }
    }

    await invalidate(`ranking:${poolId}`, 'ranking:global');
    const entries = await this.forPool(poolId);
    await publishRealtime({ channel: CHANNELS.ranking, poolId, entries });
  },
};
