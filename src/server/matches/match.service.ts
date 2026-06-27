import { prisma } from '@/lib/prisma';
import { cached } from '@/lib/redis';
import type { MatchStage, Prisma } from '@prisma/client';

const matchInclude = {
  homeTeam: true,
  awayTeam: true,
} satisfies Prisma.MatchInclude;

export type MatchWithTeams = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;

export const matchService = {
  /** Lista partidas com cache Redis de 60s. */
  async list(filters?: { stage?: MatchStage; round?: number; groupName?: string }) {
    const key = `matches:${filters?.stage ?? 'all'}:${filters?.round ?? 'all'}:${filters?.groupName ?? 'all'}`;
    return cached(key, 60, () =>
      prisma.match.findMany({
        where: {
          ...(filters?.stage ? { stage: filters.stage } : {}),
          ...(filters?.round ? { round: filters.round } : {}),
          ...(filters?.groupName ? { groupName: filters.groupName } : {}),
        },
        include: matchInclude,
        orderBy: { kickoffAt: 'asc' },
      }),
    );
  },

  async upcoming(limit = 5) {
    return cached(`matches:upcoming:${limit}`, 60, () =>
      prisma.match.findMany({
        where: { status: 'SCHEDULED', kickoffAt: { gte: new Date() } },
        include: matchInclude,
        orderBy: { kickoffAt: 'asc' },
        take: limit,
      }),
    );
  },

  async standings() {
    const rows = await cached('standings', 120, () =>
      prisma.standing.findMany({
        include: { team: true },
        orderBy: [{ groupName: 'asc' }, { points: 'desc' }, { goalsFor: 'desc' }],
      }),
    );
    // Sort in memory with proper FIFA tiebreakers: pts → GD → GF
    return [...rows].sort((a, b) => {
      if (a.groupName !== b.groupName) return a.groupName.localeCompare(b.groupName);
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
  },
};
