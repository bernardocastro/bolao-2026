/**
 * repair-pool-bets.ts
 *
 * Fixes the bug where switching pools in /matches showed the wrong pool's
 * bet values in the input fields, causing users to unknowingly miss saving
 * their bet in a pool.
 *
 * For each recently-played match (LIVE + last 7 days of FINISHED):
 *   - Finds users who bet in at least one of their pools but are missing
 *     the bet in another pool they belong to.
 *   - Copies the bet to the missing pool.
 *   - For FINISHED matches: scores the copied bet using the pool's rules
 *     and updates the member's total points.
 *
 * Usage:
 *   DATABASE_URL=<neon-url> npx tsx scripts/repair-pool-bets.ts
 *
 * Dry-run by default. Type "yes" to confirm.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Outcome = 'HOME' | 'AWAY' | 'DRAW';

function outcome(home: number, away: number): Outcome {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function scoreBet(
  bet: { homeScore: number; awayScore: number },
  result: { homeScore: number; awayScore: number },
  rules: { pointsExactScore: number; pointsCorrectWinner: number; pointsGoalDiff: number; bonusUnderdog: number },
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

async function main() {
  // ── Fetch relevant matches ────────────────────────────────────────────────
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { status: 'LIVE' },
        { status: 'FINISHED', kickoffAt: { gte: since } },
      ],
    },
    include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    orderBy: { kickoffAt: 'desc' },
  });

  if (matches.length === 0) {
    console.log('No recent matches found.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nRecent matches (${matches.length}):`);
  matches.forEach((m) =>
    console.log(
      `  [${m.id}] ${m.homeTeam.name} vs ${m.awayTeam.name}  status=${m.status}  scored=${!!m.scoredAt}  result=${m.homeScore ?? '?'}-${m.awayScore ?? '?'}`,
    ),
  );

  // ── Collect repairs needed ────────────────────────────────────────────────
  type Repair = {
    matchId: string;
    matchLabel: string;
    matchStatus: string;
    userId: string;
    userName: string;
    targetPoolId: string;
    targetPoolName: string;
    sourcePoolId: string;
    sourcePoolName: string;
    homeScore: number;
    awayScore: number;
    actualHomeScore: number | null;
    actualAwayScore: number | null;
    rules: { pointsExactScore: number; pointsCorrectWinner: number; pointsGoalDiff: number; bonusUnderdog: number };
  };

  const repairs: Repair[] = [];

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

        // This pool is missing a bet — find the best source bet to copy
        const sourceBet = [...userBets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        if (!sourceBet) continue;
        const sourcePool = await prisma.pool.findUniqueOrThrow({
          where: { id: sourceBet.poolId },
          select: { name: true },
        });
        const firstBet = userBets[0];
        if (!firstBet) continue;

        repairs.push({
          matchId: match.id,
          matchLabel: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          matchStatus: match.status,
          userId,
          userName: firstBet.user.name,
          targetPoolId: membership.poolId,
          targetPoolName: membership.pool.name,
          sourcePoolId: sourceBet.poolId,
          sourcePoolName: sourcePool.name,
          homeScore: sourceBet.homeScore,
          awayScore: sourceBet.awayScore,
          actualHomeScore: match.homeScore,
          actualAwayScore: match.awayScore,
          rules: {
            pointsExactScore: membership.pool.pointsExactScore,
            pointsCorrectWinner: membership.pool.pointsCorrectWinner,
            pointsGoalDiff: membership.pool.pointsGoalDiff,
            bonusUnderdog: membership.pool.bonusUnderdog,
          },
        });
      }
    }
  }

  if (repairs.length === 0) {
    console.log('\nNo missing bets found — nothing to repair.');
    await prisma.$disconnect();
    return;
  }

  // ── Dry-run summary ───────────────────────────────────────────────────────
  console.log(`\nREPAIRS NEEDED (${repairs.length}):`);
  for (const r of repairs) {
    const matchIsScored = matches.find((m) => m.id === r.matchId)?.scoredAt;
    let ptsNote = '';
    if (matchIsScored && r.actualHomeScore !== null && r.actualAwayScore !== null) {
      const s = scoreBet(
        { homeScore: r.homeScore, awayScore: r.awayScore },
        { homeScore: r.actualHomeScore, awayScore: r.actualAwayScore },
        r.rules,
      );
      ptsNote = ` → +${s.points} pts${s.isExactScore ? ' 🎯' : s.isCorrectWinner ? ' ✅' : ''}`;
    } else {
      ptsNote = ` → PENDING (match ${r.matchStatus})`;
    }
    console.log(
      `  ${r.userName} | ${r.matchLabel} | copy from "${r.sourcePoolName}" → "${r.targetPoolName}" | ${r.homeScore}-${r.awayScore}${ptsNote}`,
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) =>
    rl.question('\nProceed? Type "yes" to confirm: ', resolve),
  );
  rl.close();

  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted.');
    await prisma.$disconnect();
    return;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  let applied = 0;
  let pointsAwarded = 0;

  for (const r of repairs) {
    const match = matches.find((m) => m.id === r.matchId)!;
    const isScored = !!match.scoredAt;

    if (isScored && r.actualHomeScore !== null && r.actualAwayScore !== null) {
      // Match already scored — create the bet as SCORED and award points now
      const s = scoreBet(
        { homeScore: r.homeScore, awayScore: r.awayScore },
        { homeScore: r.actualHomeScore, awayScore: r.actualAwayScore },
        r.rules,
      );

      await prisma.$transaction([
        prisma.bet.create({
          data: {
            userId: r.userId,
            poolId: r.targetPoolId,
            matchId: r.matchId,
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            status: 'SCORED',
            pointsEarned: s.points,
            isExactScore: s.isExactScore,
            isCorrectWinner: s.isCorrectWinner,
          },
        }),
        prisma.poolMember.update({
          where: { poolId_userId: { poolId: r.targetPoolId, userId: r.userId } },
          data: {
            totalPoints: { increment: s.points },
            exactScores: { increment: s.isExactScore ? 1 : 0 },
            correctWinners: { increment: s.isCorrectWinner ? 1 : 0 },
          },
        }),
      ]);

      pointsAwarded += s.points;
      console.log(`  ✓ ${r.userName} in "${r.targetPoolName}" | ${r.homeScore}-${r.awayScore} | +${s.points} pts`);
    } else {
      // Match not yet scored — create as PENDING so it scores normally when the match ends
      await prisma.bet.create({
        data: {
          userId: r.userId,
          poolId: r.targetPoolId,
          matchId: r.matchId,
          homeScore: r.homeScore,
          awayScore: r.awayScore,
          status: 'PENDING',
        },
      });
      console.log(`  ✓ ${r.userName} in "${r.targetPoolName}" | ${r.homeScore}-${r.awayScore} | PENDING`);
    }

    applied++;
  }

  console.log(`\nDone! ${applied} bets repaired, ${pointsAwarded} total points awarded.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
