/**
 * copy-member-bets.ts
 *
 * Copies a user's bets and aggregated stats from a source pool to a target pool.
 *
 * Usage:
 *   DATABASE_URL=<neon-url> npx tsx scripts/copy-member-bets.ts
 *
 * What this does:
 *  1. Finds Pedro Orlando (or any user by name) and lists all his pool memberships.
 *  2. Lets you confirm source pool + target pool before touching anything.
 *  3. For each SCORED bet in the source pool whose match also exists in the target pool,
 *     upserts the bet in the target pool (skips if already exists with points).
 *  4. Recomputes totalPoints / exactScores / correctWinners on the target PoolMember.
 *
 * Safe: dry-run first, then asks for confirmation before writing.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_POOL_NAME = 'Bolão da SEMAS';
const USER_NAME_CONTAINS = 'Pedro Orlando';

async function main() {
  // ── 1. Find the user ──────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    where: { name: { contains: USER_NAME_CONTAINS, mode: 'insensitive' } },
    select: { id: true, name: true, username: true },
  });

  if (users.length === 0) {
    console.error(`No user found matching "${USER_NAME_CONTAINS}"`);
    process.exit(1);
  }
  if (users.length > 1) {
    console.error('Multiple users matched:');
    users.forEach((u) => console.error(`  ${u.id}  ${u.name}  @${u.username}`));
    console.error('Narrow USER_NAME_CONTAINS in the script and re-run.');
    process.exit(1);
  }

  const user = users[0];
  console.log(`\nUser found: ${user.name} (@${user.username})  id=${user.id}`);

  // ── 2. List all pool memberships ──────────────────────────────────────────
  const memberships = await prisma.poolMember.findMany({
    where: { userId: user.id },
    include: { pool: { select: { id: true, name: true, slug: true } } },
  });

  console.log('\nPool memberships:');
  memberships.forEach((m) => {
    console.log(
      `  [${m.pool.id}] ${m.pool.name}  pts=${m.totalPoints}  exact=${m.exactScores}  winners=${m.correctWinners}`,
    );
  });

  // ── 3. Identify target pool ───────────────────────────────────────────────
  const targetMembership = memberships.find((m) =>
    m.pool.name.toLowerCase().includes(TARGET_POOL_NAME.toLowerCase()),
  );
  if (!targetMembership) {
    console.error(`\nTarget pool "${TARGET_POOL_NAME}" not found in memberships.`);
    process.exit(1);
  }

  const sourceMemberships = memberships.filter((m) => m.pool.id !== targetMembership.pool.id);
  if (sourceMemberships.length === 0) {
    console.error('\nNo other pool to copy from.');
    process.exit(1);
  }

  // If there's more than one source, pick the one with the most points.
  const sourceMembership = sourceMemberships.sort((a, b) => b.totalPoints - a.totalPoints)[0];

  console.log(`\nSource pool : [${sourceMembership.pool.id}] ${sourceMembership.pool.name}`);
  console.log(`             pts=${sourceMembership.totalPoints}  exact=${sourceMembership.exactScores}  winners=${sourceMembership.correctWinners}`);
  console.log(`Target pool : [${targetMembership.pool.id}] ${targetMembership.pool.name}`);
  console.log(`             pts=${targetMembership.totalPoints}  exact=${targetMembership.exactScores}  winners=${targetMembership.correctWinners}`);

  // ── 4. Fetch source bets (only SCORED — finished matches) ─────────────────
  const sourceBets = await prisma.bet.findMany({
    where: { userId: user.id, poolId: sourceMembership.pool.id, status: 'SCORED' },
    include: { match: { select: { id: true, homeScore: true, awayScore: true, status: true } } },
  });

  console.log(`\nSCORED bets in source pool: ${sourceBets.length}`);

  // Only copy bets for matches that are also in the target pool
  // (matches are global; "in a pool" just means a Bet row with that poolId exists or the match is visible to all)
  // We'll upsert for every SCORED match found in the source.
  const existingTargetBets = await prisma.bet.findMany({
    where: { userId: user.id, poolId: targetMembership.pool.id },
    select: { matchId: true, status: true, pointsEarned: true },
  });

  const existingMap = new Map(existingTargetBets.map((b) => [b.matchId, b]));

  const toCreate: typeof sourceBets = [];
  const skipped: typeof sourceBets = [];

  for (const bet of sourceBets) {
    const existing = existingMap.get(bet.matchId);
    if (existing && existing.status === 'SCORED' && (existing.pointsEarned ?? 0) > 0) {
      skipped.push(bet);
    } else {
      toCreate.push(bet);
    }
  }

  // ── 5. Dry run summary ────────────────────────────────────────────────────
  console.log(`\nDRY RUN:`);
  console.log(`  Bets to copy  : ${toCreate.length}`);
  console.log(`  Bets skipped  : ${skipped.length} (already scored in target)`);

  let projectedPts = 0, projectedExact = 0, projectedWinners = 0;
  for (const b of toCreate) {
    projectedPts += b.pointsEarned ?? 0;
    if (b.isExactScore) projectedExact++;
    if (b.isCorrectWinner) projectedWinners++;
  }
  console.log(`  Points to add : ${projectedPts}`);
  console.log(`  Exact scores  : ${projectedExact}`);
  console.log(`  Correct winners: ${projectedWinners}`);

  if (toCreate.length === 0) {
    console.log('\nNothing to do. Exiting.');
    await prisma.$disconnect();
    return;
  }

  // ── 6. Confirm ────────────────────────────────────────────────────────────
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

  // ── 7. Apply ──────────────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    for (const bet of toCreate) {
      await tx.bet.upsert({
        where: {
          userId_poolId_matchId: {
            userId: user.id,
            poolId: targetMembership.pool.id,
            matchId: bet.matchId,
          },
        },
        create: {
          userId: user.id,
          poolId: targetMembership.pool.id,
          matchId: bet.matchId,
          homeScore: bet.homeScore,
          awayScore: bet.awayScore,
          status: bet.status,
          pointsEarned: bet.pointsEarned,
          isExactScore: bet.isExactScore,
          isCorrectWinner: bet.isCorrectWinner,
        },
        update: {
          homeScore: bet.homeScore,
          awayScore: bet.awayScore,
          status: bet.status,
          pointsEarned: bet.pointsEarned,
          isExactScore: bet.isExactScore,
          isCorrectWinner: bet.isCorrectWinner,
        },
      });
    }

    // Recompute aggregates for the target PoolMember from scratch
    const allTargetBets = await tx.bet.findMany({
      where: { userId: user.id, poolId: targetMembership.pool.id, status: 'SCORED' },
      select: { pointsEarned: true, isExactScore: true, isCorrectWinner: true },
    });

    const totalPoints = allTargetBets.reduce((s, b) => s + (b.pointsEarned ?? 0), 0);
    const exactScores = allTargetBets.filter((b) => b.isExactScore).length;
    const correctWinners = allTargetBets.filter((b) => b.isCorrectWinner).length;

    await tx.poolMember.update({
      where: { poolId_userId: { poolId: targetMembership.pool.id, userId: user.id } },
      data: { totalPoints, exactScores, correctWinners },
    });

    console.log(`\nDone!`);
    console.log(`  Bets upserted : ${toCreate.length}`);
    console.log(`  New totals    : pts=${totalPoints}  exact=${exactScores}  winners=${correctWinners}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
