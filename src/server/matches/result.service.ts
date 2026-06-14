import { prisma } from '@/lib/prisma';
import { invalidate, publishRealtime, CHANNELS } from '@/lib/redis';
import { ApiError, NotFoundError } from '@/lib/api';
import { scoreBet, applyUniqueHitBonus } from '@/server/bets/scoring.engine';
import { feedService } from '@/server/feed/feed.service';
import { notificationService } from '@/server/notifications/notification.service';
import { rankingService } from '@/server/ranking/ranking.service';

interface SetResultInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status?: 'LIVE' | 'FINISHED';
}

export const resultService = {
  /**
   * Atualiza resultado de uma partida e, se FINISHED, processa toda a cadeia:
   * pontuação → agregados → rankings → feed → notificações.
   */
  async setResult(input: SetResultInput): Promise<void> {
    const match = await prisma.match.findUnique({
      where: { id: input.matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundError('Partida');
    if (match.scoredAt) throw new ApiError(409, 'Partida já pontuada');

    const status = input.status ?? 'FINISHED';
    await prisma.match.update({
      where: { id: match.id },
      data: { homeScore: input.homeScore, awayScore: input.awayScore, status },
    });
    await invalidate('standings');
    await publishRealtime({
      channel: CHANNELS.match,
      matchId: match.id,
      payload: { matchId: match.id, homeScore: input.homeScore, awayScore: input.awayScore, status },
    });

    if (status !== 'FINISHED') return;
    await this.processScores(match.id, input.homeScore, input.awayScore);
  },

  async processScores(matchId: string, homeScore: number, awayScore: number): Promise<void> {
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    const scoreLabel = `${match.homeTeam.name} ${homeScore} x ${awayScore} ${match.awayTeam.name}`;

    // Fetch ALL bets per pool (any status) so uniqueness is computed correctly
    // even if some bets were already scored in a prior partial run.
    const pools = await prisma.pool.findMany({
      where: { bets: { some: { matchId } } },
      include: {
        bets: {
          where: { matchId },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    for (const pool of pools) {
      const rules = {
        pointsExactScore: pool.pointsExactScore,
        pointsCorrectWinner: pool.pointsCorrectWinner,
        pointsGoalDiff: pool.pointsGoalDiff,
        bonusUnderdog: pool.bonusUnderdog,
        bonusUniqueHit: pool.bonusUniqueHit,
      };

      // Score all bets (including already-SCORED ones) to determine uniqueness correctly.
      const scored = applyUniqueHitBonus(
        pool.bets.map((bet) => ({
          bet,
          score: scoreBet(
            { homeScore: bet.homeScore, awayScore: bet.awayScore },
            { homeScore, awayScore },
            rules,
          ),
        })),
        rules,
      );

      for (const { bet, score, isUniqueHit } of scored) {
        // Only update bets that haven't been scored yet.
        if (bet.status !== 'PENDING') continue;

        await prisma.$transaction([
          prisma.bet.update({
            where: { id: bet.id },
            data: {
              status: 'SCORED',
              pointsEarned: score.points,
              isExactScore: score.isExactScore,
              isCorrectWinner: score.isCorrectWinner,
            },
          }),
          prisma.poolMember.update({
            where: { poolId_userId: { poolId: pool.id, userId: bet.userId } },
            data: {
              totalPoints: { increment: score.points },
              exactScores: { increment: score.isExactScore ? 1 : 0 },
              correctWinners: { increment: score.isCorrectWinner ? 1 : 0 },
              streak: score.isCorrectWinner ? { increment: 1 } : 0,
            },
          }),
        ]);

        if (score.isExactScore) {
          await feedService.publish({
            type: isUniqueHit ? 'UNIQUE_HIT' : 'EXACT_SCORE_HIT',
            poolId: pool.id,
            actorId: bet.userId,
            content: isUniqueHit
              ? `🎯 ${bet.user.name} foi o ÚNICO a cravar ${scoreLabel}!`
              : `🎯 ${bet.user.name} cravou o placar de ${scoreLabel}!`,
            metadata: { matchId, points: score.points },
          });
        }
        if (score.points > 0) {
          await notificationService.notify({
            userId: bet.userId,
            type: 'MATCH_SCORED',
            title: `+${score.points} pontos!`,
            body: `${scoreLabel} — ${score.isExactScore ? 'placar exato! 🎯' : 'você acertou o resultado'}`,
            link: '/matches',
          });
        }
      }

      await feedService.publish({
        type: 'MATCH_RESULT',
        poolId: pool.id,
        content: `⚽ Fim de jogo: ${scoreLabel}`,
        metadata: { matchId, homeScore, awayScore },
      });

      await rankingService.recompute(pool.id, { matchLabel: scoreLabel });
    }

    await prisma.match.update({ where: { id: matchId }, data: { scoredAt: new Date() } });
    await this.updateStandings(match.id, homeScore, awayScore);
  },

  async updateStandings(matchId: string, homeScore: number, awayScore: number): Promise<void> {
    const match = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    if (match.stage !== 'GROUP' || !match.groupName) return;

    const apply = async (teamId: string, gf: number, ga: number) => {
      await prisma.standing.update({
        where: { teamId_groupName: { teamId, groupName: match.groupName! } },
        data: {
          played: { increment: 1 },
          won: { increment: gf > ga ? 1 : 0 },
          drawn: { increment: gf === ga ? 1 : 0 },
          lost: { increment: gf < ga ? 1 : 0 },
          goalsFor: { increment: gf },
          goalsAgainst: { increment: ga },
          points: { increment: gf > ga ? 3 : gf === ga ? 1 : 0 },
        },
      });
    };
    await apply(match.homeTeamId, homeScore, awayScore);
    await apply(match.awayTeamId, awayScore, homeScore);
    await invalidate('standings');
  },
};
