import { withErrorHandling, parseBody, json, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { feedService } from '@/server/feed/feed.service';
import { notificationService } from '@/server/notifications/notification.service';
import { fetchAllRosterPlayers } from '@/server/football/espn-roster';
import { z } from 'zod';

interface Ctx {
  params: { poolId: string };
}

const resultSchema = z.object({ playerName: z.string().min(1) });

export const POST = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { poolId } = params;

  const member = await prisma.poolMember.findUnique({
    where: { poolId_userId: { poolId, userId: session.sub } },
  });
  if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
    throw new ApiError(403, 'Apenas o admin do bolão pode confirmar o artilheiro');
  }

  const { playerName } = await parseBody(req, resultSchema);

  const players = await fetchAllRosterPlayers();
  const validNames = new Set(players.map((p) => p.name));
  if (!validNames.has(playerName)) throw new ApiError(400, 'Jogador inválido');

  const pool = await prisma.pool.findUniqueOrThrow({
    where: { id: poolId },
    select: { id: true, name: true, bonusTopScorer: true, topScorerResult: true },
  });

  if (pool.topScorerResult) {
    throw new ApiError(409, 'Artilheiro já confirmado para este bolão');
  }

  const picks = await prisma.topScorerPick.findMany({
    where: { poolId, scored: false },
    include: { user: { select: { id: true, name: true } } },
  });

  const winners = picks.filter((p) => p.playerName === playerName);

  await prisma.$transaction(async (tx) => {
    await tx.topScorerPick.updateMany({ where: { poolId, scored: false }, data: { scored: true } });
    await tx.pool.update({ where: { id: poolId }, data: { topScorerResult: playerName } });

    for (const pick of winners) {
      await tx.poolMember.update({
        where: { poolId_userId: { poolId, userId: pick.userId } },
        data: { totalPoints: { increment: pool.bonusTopScorer } },
      });
    }
  });

  await feedService.publish({
    type: 'TOP_SCORER_HIT',
    poolId,
    content: `🥅 Artilheiro confirmado: ${playerName}! ${winners.length > 0 ? `${winners.length} participante(s) acertaram e ganham +${pool.bonusTopScorer} pts!` : 'Ninguém acertou desta vez.'}`,
    metadata: { playerName, winners: winners.map((w) => w.user.name) },
  });

  for (const pick of winners) {
    await notificationService.notify({
      userId: pick.userId,
      type: 'GENERIC',
      title: `+${pool.bonusTopScorer} pontos! Você acertou o artilheiro! 🥅`,
      body: `${playerName} foi o artilheiro do torneio em "${pool.name}".`,
      link: `/pools/${poolId}`,
    });
  }

  return json({ playerName, winners: winners.length, bonus: pool.bonusTopScorer });
});
