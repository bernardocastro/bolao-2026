import { prisma } from '@/lib/prisma';
import { publishRealtime, CHANNELS, redis } from '@/lib/redis';
import { resultService } from '@/server/matches/result.service';
import { getFootballProvider } from './football.provider';

export interface SyncSummary {
  fetched: number;
  linked: number;
  kickoffUpdated: number;
  liveUpdated: number;
  finishedProcessed: number;
  unmatched: number;
  errors: string[];
}

async function invalidateMatchCaches(): Promise<void> {
  try {
    const keys = await redis.keys('matches:*');
    if (keys.length) await redis.del(...keys);
  } catch {
    /* cache expira sozinho em 60s */
  }
}

/**
 * Sincroniza partidas com o provider externo:
 * - vincula fixtures (externalId) aos jogos do banco por confronto;
 * - atualiza horários remarcados;
 * - atualiza placar ao vivo (publica via Socket.IO);
 * - ao encerrar, dispara a cadeia completa de pontuação/ranking/feed.
 * Idempotente — pode rodar em loop sem efeitos duplicados.
 */
export const syncService = {
  async run(): Promise<SyncSummary> {
    const summary: SyncSummary = {
      fetched: 0,
      linked: 0,
      kickoffUpdated: 0,
      liveUpdated: 0,
      finishedProcessed: 0,
      unmatched: 0,
      errors: [],
    };

    const fixtures = await getFootballProvider().fetchMatches();
    summary.fetched = fixtures.length;
    if (fixtures.length === 0) return summary;

    const teams = await prisma.team.findMany({ select: { id: true, code: true } });
    const idByCode = new Map(teams.map((t) => [t.code, t.id]));

    for (const fixture of fixtures) {
      try {
        // 1) localiza o jogo: por externalId já vinculado, senão pelo confronto
        let match = await prisma.match.findUnique({ where: { externalId: fixture.externalId } });

        const homeId = fixture.homeTeamCode ? idByCode.get(fixture.homeTeamCode) : undefined;
        const awayId = fixture.awayTeamCode ? idByCode.get(fixture.awayTeamCode) : undefined;

        if (!match && homeId && awayId) {
          match = await prisma.match.findFirst({
            where: {
              externalId: null,
              OR: [
                { homeTeamId: homeId, awayTeamId: awayId },
                { homeTeamId: awayId, awayTeamId: homeId },
              ],
            },
          });
          if (match) {
            match = await prisma.match.update({
              where: { id: match.id },
              data: { externalId: fixture.externalId },
            });
            summary.linked++;
          }
        }
        if (!match) {
          summary.unmatched++;
          continue;
        }

        // 1b) resolve TBD teams: when ESPN now knows the real teams for a knockout slot
        if (match.homeTeamId === null && homeId) {
          match = await prisma.match.update({
            where: { id: match.id },
            data: { homeTeamId: homeId, homePlaceholder: null },
          });
          await invalidateMatchCaches();
        }
        if (match.awayTeamId === null && awayId) {
          match = await prisma.match.update({
            where: { id: match.id },
            data: { awayTeamId: awayId, awayPlaceholder: null },
          });
          await invalidateMatchCaches();
        }

        // provider pode listar mandante invertido em relação ao nosso banco
        const swapped = homeId !== undefined && match.homeTeamId !== null && match.homeTeamId !== homeId;
        const homeScore = swapped ? fixture.awayScore : fixture.homeScore;
        const awayScore = swapped ? fixture.homeScore : fixture.awayScore;
        const oddsHome = swapped ? fixture.oddsAway : fixture.oddsHome;
        const oddsAway = swapped ? fixture.oddsHome : fixture.oddsAway;
        const oddsDraw = fixture.oddsDraw;

        // 2) horário remarcado e odds (só antes de começar)
        if (match.status === 'SCHEDULED' && fixture.status === 'SCHEDULED') {
          const kickoffChanged = match.kickoffAt.getTime() !== fixture.kickoffAt.getTime();
          const oddsChanged =
            match.oddsHome !== oddsHome ||
            match.oddsDraw !== oddsDraw ||
            match.oddsAway !== oddsAway;

          if (kickoffChanged || oddsChanged) {
            await prisma.match.update({
              where: { id: match.id },
              data: {
                ...(kickoffChanged ? { kickoffAt: fixture.kickoffAt } : {}),
                ...(oddsChanged ? { oddsHome, oddsDraw, oddsAway } : {}),
              },
            });
            if (kickoffChanged) summary.kickoffUpdated++;
          }
        }

        // 3) jogo ao vivo: placar parcial em tempo real
        // skip if already scored — provider can lag and keep returning LIVE after the match ended
        if (fixture.status === 'LIVE' && homeScore !== null && awayScore !== null && !match.scoredAt) {
          if (
            match.status !== 'LIVE' ||
            match.homeScore !== homeScore ||
            match.awayScore !== awayScore
          ) {
            await prisma.match.update({
              where: { id: match.id },
              data: { status: 'LIVE', homeScore, awayScore },
            });
            await publishRealtime({
              channel: CHANNELS.match,
              matchId: match.id,
              payload: { matchId: match.id, homeScore, awayScore, status: 'LIVE' },
            });
            summary.liveUpdated++;
          }
        }

        // 4) fim de jogo: dispara pontuação completa (uma única vez)
        if (
          fixture.status === 'FINISHED' &&
          !match.scoredAt &&
          homeScore !== null &&
          awayScore !== null
        ) {
          await resultService.setResult({
            matchId: match.id,
            homeScore,
            awayScore,
            status: 'FINISHED',
          });
          summary.finishedProcessed++;
        }

        // 4b) self-heal: match already scored but status got stuck (race condition between
        //     concurrent sync runs — one run set LIVE while the other was mid-scoring)
        if (match.scoredAt && match.status !== 'FINISHED' && match.status !== 'POSTPONED') {
          await prisma.match.update({ where: { id: match.id }, data: { status: 'FINISHED' } });
          await invalidateMatchCaches();
        }

        if (fixture.status === 'POSTPONED' && match.status === 'SCHEDULED') {
          await prisma.match.update({ where: { id: match.id }, data: { status: 'POSTPONED' } });
        }
      } catch (error) {
        summary.errors.push(
          `fixture ${fixture.externalId}: ${error instanceof Error ? error.message : 'erro'}`,
        );
      }
    }

    if (summary.kickoffUpdated || summary.liveUpdated || summary.finishedProcessed) {
      await invalidateMatchCaches();
    }
    return summary;
  },
};
