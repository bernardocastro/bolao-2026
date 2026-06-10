import { withErrorHandling, json, NotFoundError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { achievementService } from '@/server/achievements/achievement.service';

interface Ctx {
  params: { username: string };
}

export const GET = withErrorHandling(async (_req: Request, { params }: Ctx) => {
  await requireSession();
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      poolMemberships: {
        select: {
          totalPoints: true,
          exactScores: true,
          correctWinners: true,
          currentRank: true,
          pool: { select: { name: true, slug: true } },
        },
      },
    },
  });
  if (!user) throw new NotFoundError('Usuário');

  const achievements = await achievementService.forUser(user.id);
  const stats = user.poolMemberships.reduce(
    (acc, m) => ({
      totalPoints: acc.totalPoints + m.totalPoints,
      exactScores: acc.exactScores + m.exactScores,
      correctWinners: acc.correctWinners + m.correctWinners,
    }),
    { totalPoints: 0, exactScores: 0, correctWinners: 0 },
  );

  return json({ user, stats, achievements });
});
