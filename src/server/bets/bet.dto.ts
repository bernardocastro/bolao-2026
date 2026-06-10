import { z } from 'zod';

export const upsertBetSchema = z.object({
  poolId: z.string().cuid(),
  matchId: z.string().cuid(),
  homeScore: z.number().int().min(0).max(20),
  awayScore: z.number().int().min(0).max(20),
  advancingTeamId: z.string().cuid().optional(),
});

export type UpsertBetInput = z.infer<typeof upsertBetSchema>;
