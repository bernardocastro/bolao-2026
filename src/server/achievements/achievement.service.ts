import { prisma } from '@/lib/prisma';
import { feedService } from '@/server/feed/feed.service';
import { notificationService } from '@/server/notifications/notification.service';

type Checker = (stats: {
  userId: string;
  poolId: string;
  exactScores: number;
  correctWinners: number;
  streak: number;
  totalBets: number;
}) => Promise<boolean> | boolean;

/** Regras de desbloqueio — declarativas e extensíveis. */
const CHECKS: Record<string, Checker> = {
  FIRST_BLOOD: (s) => s.totalBets >= 1,
  PROPHET: (s) => s.exactScores >= 5,
  ON_FIRE: (s) => s.streak >= 5,
  SHARPSHOOTER: async (s) => {
    // 3 placares exatos em jogos da mesma rodada
    const hits = await prisma.bet.findMany({
      where: { userId: s.userId, poolId: s.poolId, isExactScore: true },
      include: { match: { select: { round: true, stage: true } } },
    });
    const byRound = new Map<string, number>();
    for (const h of hits) {
      const key = `${h.match.stage}:${h.match.round}`;
      byRound.set(key, (byRound.get(key) ?? 0) + 1);
    }
    return [...byRound.values()].some((n) => n >= 3);
  },
  ZEBRA_MASTER: async (s) => {
    const count = await prisma.bet.count({
      where: { userId: s.userId, poolId: s.poolId, isCorrectWinner: true, match: { stage: 'GROUP' } },
    });
    return count >= 1 && s.exactScores >= 1;
  },
  KNOCKOUT_KING: async (s) => {
    const count = await prisma.bet.count({
      where: {
        userId: s.userId,
        poolId: s.poolId,
        isCorrectWinner: true,
        match: { stage: { not: 'GROUP' } },
      },
    });
    return count >= 4;
  },
};

export const achievementService = {
  /** Avalia e desbloqueia conquistas pendentes do usuário. */
  async evaluate(userId: string, poolId: string): Promise<void> {
    const [member, totalBets, unlocked, all] = await Promise.all([
      prisma.poolMember.findUnique({ where: { poolId_userId: { poolId, userId } } }),
      prisma.bet.count({ where: { userId, poolId } }),
      prisma.userAchievement.findMany({ where: { userId }, select: { achievement: { select: { code: true } } } }),
      prisma.achievement.findMany(),
    ]);
    if (!member) return;

    const unlockedCodes = new Set(unlocked.map((u) => u.achievement.code));
    const stats = {
      userId,
      poolId,
      exactScores: member.exactScores,
      correctWinners: member.correctWinners,
      streak: member.streak,
      totalBets,
    };

    for (const achievement of all) {
      if (unlockedCodes.has(achievement.code)) continue;
      const check = CHECKS[achievement.code];
      if (!check) continue;
      if (!(await check(stats))) continue;

      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
      await feedService.publish({
        type: 'ACHIEVEMENT',
        poolId,
        actorId: userId,
        content: `🏅 ${user.name} desbloqueou a conquista "${achievement.name}"!`,
        metadata: { achievementCode: achievement.code, icon: achievement.icon },
      });
      await notificationService.notify({
        userId,
        type: 'ACHIEVEMENT_UNLOCKED',
        title: `Conquista desbloqueada: ${achievement.name} 🏅`,
        body: achievement.description,
        link: `/profile`,
      });
    }
  },

  async forUser(userId: string) {
    const [all, mine] = await Promise.all([
      prisma.achievement.findMany({ orderBy: { tier: 'asc' } }),
      prisma.userAchievement.findMany({ where: { userId } }),
    ]);
    const unlockedIds = new Map(mine.map((m) => [m.achievementId, m.unlockedAt]));
    return all.map((a) => ({
      ...a,
      unlockedAt: unlockedIds.get(a.id) ?? null,
    }));
  },
};
