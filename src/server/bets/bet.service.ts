import { prisma } from '@/lib/prisma';
import { ApiError, NotFoundError } from '@/lib/api';
import type { UpsertBetInput } from './bet.dto';

export const betService = {
  /**
   * Cria/edita palpite. Lock automático: rejeita após o kickoff (UTC).
   * Palpites são editáveis livremente até o início da partida.
   */
  async upsert(userId: string, input: UpsertBetInput) {
    const [match, membership] = await Promise.all([
      prisma.match.findUnique({ where: { id: input.matchId } }),
      prisma.poolMember.findUnique({
        where: { poolId_userId: { poolId: input.poolId, userId } },
      }),
    ]);
    if (!match) throw new NotFoundError('Partida');
    if (!membership) throw new ApiError(403, 'Você não participa deste bolão');
    if (match.status !== 'SCHEDULED' || match.kickoffAt <= new Date()) {
      throw new ApiError(409, 'Palpites encerrados para esta partida');
    }
    if (
      match.stage !== 'GROUP' &&
      input.homeScore === input.awayScore &&
      !input.advancingTeamId
    ) {
      throw new ApiError(422, 'No mata-mata, informe quem avança em caso de empate');
    }

    return prisma.bet.upsert({
      where: {
        userId_poolId_matchId: { userId, poolId: input.poolId, matchId: input.matchId },
      },
      create: { userId, ...input },
      update: {
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        advancingTeamId: input.advancingTeamId ?? null,
      },
    });
  },

  /** Palpites do usuário em um bolão, indexados por matchId. */
  async listForUser(userId: string, poolId: string) {
    return prisma.bet.findMany({
      where: { userId, poolId },
      select: {
        matchId: true,
        homeScore: true,
        awayScore: true,
        advancingTeamId: true,
        pointsEarned: true,
        status: true,
        isExactScore: true,
        isCorrectWinner: true,
      },
    });
  },

  /** Palpites de todos os membros para uma partida (visível só após o lock). */
  async listForMatch(userId: string, poolId: string, matchId: string) {
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundError('Partida');
    if (match.kickoffAt > new Date()) {
      throw new ApiError(403, 'Palpites dos outros ficam visíveis após o início do jogo');
    }
    return prisma.bet.findMany({
      where: { poolId, matchId },
      include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      orderBy: { pointsEarned: 'desc' },
    });
  },
};
