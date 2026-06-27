import { withErrorHandling, json, ApiError } from '@/lib/api';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const maxDuration = 60;

async function authorize(req: Request): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const queryOk = Boolean(secret) && url.searchParams.get('secret') === secret;
  const headerOk = Boolean(secret) && req.headers.get('x-cron-secret') === secret;
  const bearerOk = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
  if (queryOk || headerOk || bearerOk) return;
  const session = await getSession();
  if (session?.role !== 'ADMIN') throw new ApiError(401, 'Não autorizado');
}

type Outcome = 'HOME' | 'AWAY' | 'DRAW';

function outcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function scoreBet(
  bet: { homeScore: number; awayScore: number },
  result: { homeScore: number; awayScore: number },
  rules: { pointsExactScore: number; pointsCorrectWinner: number; pointsGoalDiff: number },
) {
  const betOutcome = outcome(bet.homeScore, bet.awayScore);
  const realOutcome = outcome(result.homeScore, result.awayScore);
  const isCorrectWinner = betOutcome === realOutcome;
  const isExactScore =
    isCorrectWinner &&
    bet.homeScore === result.homeScore &&
    bet.awayScore === result.awayScore;
  const isGoalDiff =
    isCorrectWinner &&
    !isExactScore &&
    bet.homeScore - bet.awayScore === result.homeScore - result.awayScore;

  let points = 0;
  if (isExactScore) points = rules.pointsExactScore;
  else if (isGoalDiff) points = rules.pointsGoalDiff;
  else if (isCorrectWinner) points = rules.pointsCorrectWinner;

  return { points, isExactScore, isCorrectWinner };
}

export const POST = withErrorHandling(async (req: Request) => {
  await authorize(req);

  const url = new URL(req.url);
  const daysBack = Number(url.searchParams.get('days') ?? '30');
  const dryRun = url.searchParams.get('dry') === 'true';

  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ status: 'LIVE' }, { status: 'FINISHED', kickoffAt: { gte: since } }],
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  const log: string[] = [];
  let created = 0;
  let pointsAwarded = 0;

  for (const match of matches) {
    const allBets = await prisma.bet.findMany({
      where: { matchId: match.id },
      include: { user: { select: { id: true, name: true } } },
    });

    const betsByUser = new Map<string, typeof allBets>();
    for (const bet of allBets) {
      if (!betsByUser.has(bet.userId)) betsByUser.set(bet.userId, []);
      betsByUser.get(bet.userId)!.push(bet);
    }

    for (const [userId, userBets] of betsByUser) {
      const memberships = await prisma.poolMember.findMany({
        where: { userId },
        include: { pool: true },
      });

      const poolsWithBet = new Set(userBets.map((b) => b.poolId));

      for (const membership of memberships) {
        if (poolsWithBet.has(membership.poolId)) continue;

        const sourceBet = [...userBets].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0];
        if (!sourceBet) continue;

        const userName = userBets[0]?.user.name ?? userId;
        const matchLabel = `${match.homeTeam?.name ?? "?"} vs ${match.awayTeam?.name ?? "?"}`;
        const isScored = !!match.scoredAt;

        if (dryRun) {
          log.push(
            `[dry] ${userName} | ${matchLabel} | → "${membership.pool.name}" | ${sourceBet.homeScore}-${sourceBet.awayScore}`,
          );
          continue;
        }

        if (isScored && match.homeScore !== null && match.awayScore !== null) {
          const s = scoreBet(
            { homeScore: sourceBet.homeScore, awayScore: sourceBet.awayScore },
            { homeScore: match.homeScore, awayScore: match.awayScore },
            {
              pointsExactScore: membership.pool.pointsExactScore,
              pointsCorrectWinner: membership.pool.pointsCorrectWinner,
              pointsGoalDiff: membership.pool.pointsGoalDiff,
            },
          );

          await prisma.$transaction([
            prisma.bet.create({
              data: {
                userId,
                poolId: membership.poolId,
                matchId: match.id,
                homeScore: sourceBet.homeScore,
                awayScore: sourceBet.awayScore,
                status: 'SCORED',
                pointsEarned: s.points,
                isExactScore: s.isExactScore,
                isCorrectWinner: s.isCorrectWinner,
              },
            }),
            prisma.poolMember.update({
              where: { poolId_userId: { poolId: membership.poolId, userId } },
              data: {
                totalPoints: { increment: s.points },
                exactScores: { increment: s.isExactScore ? 1 : 0 },
                correctWinners: { increment: s.isCorrectWinner ? 1 : 0 },
              },
            }),
          ]);

          pointsAwarded += s.points;
          log.push(
            `✓ ${userName} | ${matchLabel} | → "${membership.pool.name}" | ${sourceBet.homeScore}-${sourceBet.awayScore} | +${s.points} pts`,
          );
        } else {
          await prisma.bet.create({
            data: {
              userId,
              poolId: membership.poolId,
              matchId: match.id,
              homeScore: sourceBet.homeScore,
              awayScore: sourceBet.awayScore,
              status: 'PENDING',
            },
          });
          log.push(
            `✓ ${userName} | ${matchLabel} | → "${membership.pool.name}" | ${sourceBet.homeScore}-${sourceBet.awayScore} | PENDING`,
          );
        }

        created++;
      }
    }
  }

  return json({ dryRun, daysBack, created, pointsAwarded, log });
});
