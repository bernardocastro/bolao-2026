import { withErrorHandling, json, ApiError } from '@/lib/api';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { invalidate } from '@/lib/redis';
import type { MatchStage } from '@prisma/client';

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

/** ESPN abbreviation → stage mapping based on date windows */
function stageForDate(dateStr: string): MatchStage {
  const d = dateStr.slice(0, 10);
  if (d <= '2026-07-07') return 'ROUND_OF_32';
  if (d <= '2026-07-12') return 'ROUND_OF_16';
  if (d <= '2026-07-15') return 'QUARTER_FINAL';
  if (d === '2026-07-18') return 'THIRD_PLACE';
  if (d <= '2026-07-19') return 'SEMI_FINAL';
  return 'FINAL';
}

/** Translate ESPN placeholder codes to readable labels */
function placeholderLabel(code: string): string {
  if (!code || code.length <= 1) return 'A definir';
  const pos = code[0];
  const group = code.slice(1);
  if (pos === '1') return `1º Grupo ${group}`;
  if (pos === '2') return `2º Grupo ${group}`;
  if (code === '3RD') return '3º melhor';
  if (code.startsWith('RD32')) return 'Oitavas';
  if (code.startsWith('RD16')) return 'Quartas';
  if (code.startsWith('QF')) return 'Semi';
  if (code.startsWith('SF')) return 'Final';
  return code;
}

interface EspnEvent {
  id: string;
  date: string;
  competitions: Array<{
    status: { type: { state: string; completed: boolean; name: string } };
    competitors: Array<{
      homeAway: 'home' | 'away';
      score: string;
      team: { abbreviation: string; displayName: string };
    }>;
    venue?: { fullName?: string };
  }>;
}

/**
 * Seeds all knockout-stage matches from ESPN into the DB.
 * Idempotent — skips matches that already exist (by externalId).
 * Upserts matches whose teams were previously TBD and are now known.
 */
export const POST = withErrorHandling(async (req: Request) => {
  await authorize(req);

  const from = '20260628';
  const to = '20260820';
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${from}-${to}&limit=300`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new ApiError(502, `ESPN respondeu ${res.status}`);
  const data = (await res.json()) as { events: EspnEvent[] };

  const teams = await prisma.team.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(teams.map((t) => [t.code, t.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of data.events) {
    const comp = event.competitions[0];
    if (!comp) continue;
    const externalId = `espn_${event.id}`;
    const stage = stageForDate(event.date);
    const statusType = comp.status.type;

    const homeComp = comp.competitors.find((c) => c.homeAway === 'home');
    const awayComp = comp.competitors.find((c) => c.homeAway === 'away');
    const homeCode = homeComp?.team.abbreviation ?? null;
    const awayCode = awayComp?.team.abbreviation ?? null;

    // Resolve real team IDs (null if placeholder)
    const homeTeamId = homeCode ? (idByCode.get(homeCode) ?? null) : null;
    const awayTeamId = awayCode ? (idByCode.get(awayCode) ?? null) : null;
    const homePlaceholder = homeTeamId ? null : (homeCode ?? 'TBD');
    const awayPlaceholder = awayTeamId ? null : (awayCode ?? 'TBD');

    const kickoffAt = new Date(event.date);
    const venue = (comp as { venue?: { fullName?: string } }).venue?.fullName ?? null;

    let status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' = 'SCHEDULED';
    if (statusType.name === 'STATUS_POSTPONED') status = 'POSTPONED';
    else if (statusType.state === 'post' && statusType.completed) status = 'FINISHED';
    else if (statusType.state === 'in') status = 'LIVE';

    const homeScore =
      status !== 'SCHEDULED' && homeComp?.score
        ? (parseInt(homeComp.score, 10) || null)
        : null;
    const awayScore =
      status !== 'SCHEDULED' && awayComp?.score
        ? (parseInt(awayComp.score, 10) || null)
        : null;

    const existing = await prisma.match.findUnique({ where: { externalId } });

    if (!existing) {
      await prisma.match.create({
        data: {
          externalId,
          stage,
          round: 1,
          kickoffAt,
          venue,
          status,
          homeTeamId,
          awayTeamId,
          homePlaceholder,
          awayPlaceholder,
          homeScore,
          awayScore,
        },
      });
      created++;
    } else {
      // Update if teams were previously TBD and are now known
      const needsTeamUpdate =
        (existing.homeTeamId === null && homeTeamId !== null) ||
        (existing.awayTeamId === null && awayTeamId !== null);

      if (needsTeamUpdate) {
        await prisma.match.update({
          where: { id: existing.id },
          data: {
            ...(existing.homeTeamId === null && homeTeamId ? { homeTeamId, homePlaceholder: null } : {}),
            ...(existing.awayTeamId === null && awayTeamId ? { awayTeamId, awayPlaceholder: null } : {}),
            kickoffAt,
          },
        });
        updated++;
      } else {
        skipped++;
      }
    }
  }

  await invalidate('matches:all');

  return json({ ok: true, created, updated, skipped });
});
