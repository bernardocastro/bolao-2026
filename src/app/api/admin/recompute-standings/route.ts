import { withErrorHandling, json, ApiError } from '@/lib/api';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { invalidate } from '@/lib/redis';

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

/**
 * Recomputes all group standings from scratch by reading every finished
 * group-stage match in the DB. Safe to run multiple times (idempotent).
 */
export const POST = withErrorHandling(async (req: Request) => {
  await authorize(req);

  // Fetch all finished group-stage matches
  const matches = await prisma.match.findMany({
    where: { stage: 'GROUP', scoredAt: { not: null } },
    select: { id: true, groupName: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });

  // Aggregate per team per group
  const map = new Map<string, {
    teamId: string;
    groupName: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }>();

  const key = (teamId: string, groupName: string) => `${teamId}::${groupName}`;

  const apply = (teamId: string, groupName: string, gf: number, ga: number) => {
    const k = key(teamId, groupName);
    const row = map.get(k) ?? { teamId, groupName, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    row.played++;
    row.goalsFor += gf;
    row.goalsAgainst += ga;
    if (gf > ga) { row.won++; row.points += 3; }
    else if (gf === ga) { row.drawn++; row.points += 1; }
    else { row.lost++; }
    map.set(k, row);
  };

  for (const m of matches) {
    if (!m.groupName || m.homeScore === null || m.awayScore === null) continue;
    apply(m.homeTeamId, m.groupName, m.homeScore, m.awayScore);
    apply(m.awayTeamId, m.groupName, m.awayScore, m.homeScore);
  }

  // Upsert all computed standings
  let updated = 0;
  for (const row of map.values()) {
    await prisma.standing.upsert({
      where: { teamId_groupName: { teamId: row.teamId, groupName: row.groupName } },
      update: {
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
      },
      create: {
        teamId: row.teamId,
        groupName: row.groupName,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
      },
    });
    updated++;
  }

  await invalidate('standings');

  return json({ ok: true, matchesProcessed: matches.length, teamsUpdated: updated });
});
