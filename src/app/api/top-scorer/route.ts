import { withErrorHandling, parseBody, json, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { TOP_SCORER_PLAYERS, isTopScorerOpen } from '@/lib/top-scorer-players';
import { z } from 'zod';

const pickSchema = z.object({
  poolId: z.string().min(1),
  playerName: z.string().min(1),
});

const playerNames = new Set(TOP_SCORER_PLAYERS.map((p) => p.name));

export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  const { searchParams } = new URL(req.url);
  const poolId = searchParams.get('poolId');
  if (!poolId) throw new ApiError(400, 'poolId obrigatório');

  const [pick, pool] = await Promise.all([
    prisma.topScorerPick.findUnique({
      where: { userId_poolId: { userId: session.sub, poolId } },
      select: { playerName: true },
    }),
    prisma.pool.findUnique({
      where: { id: poolId },
      select: { topScorerResult: true, bonusTopScorer: true },
    }),
  ]);

  return json({
    players: TOP_SCORER_PLAYERS,
    pick: pick?.playerName ?? null,
    result: pool?.topScorerResult ?? null,
    bonus: pool?.bonusTopScorer ?? 50,
    closed: !isTopScorerOpen(),
  });
});

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  if (!isTopScorerOpen()) throw new ApiError(403, 'Prazo encerrado para escolha do artilheiro');

  const { poolId, playerName } = await parseBody(req, pickSchema);
  if (!playerNames.has(playerName)) throw new ApiError(400, 'Jogador inválido');

  const member = await prisma.poolMember.findUnique({
    where: { poolId_userId: { poolId, userId: session.sub } },
  });
  if (!member) throw new ApiError(403, 'Você não faz parte deste bolão');

  const pick = await prisma.topScorerPick.upsert({
    where: { userId_poolId: { userId: session.sub, poolId } },
    create: { userId: session.sub, poolId, playerName },
    update: { playerName },
  });

  return json({ pick: pick.playerName });
});
