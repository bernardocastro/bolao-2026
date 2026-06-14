import { z } from 'zod';

export const createPoolSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(50),
  description: z.string().max(280).optional(),
  isPrivate: z.boolean().default(true),
  maxMembers: z.number().int().min(2).max(1000).default(100),
  pointsExactScore: z.number().int().min(0).max(100).default(10),
  pointsCorrectWinner: z.number().int().min(0).max(100).default(5),
  pointsGoalDiff: z.number().int().min(0).max(100).default(7),
  bonusUnderdog: z.number().int().min(0).max(100).default(3),
  bonusUniqueHit: z.number().int().min(0).max(100).default(2),
  bonusTopScorer: z.number().int().min(0).max(200).default(50),
});

export const updatePoolRulesSchema = createPoolSchema.partial().omit({ isPrivate: true });

export const joinPoolSchema = z.object({
  inviteCode: z.string().min(4, 'Código inválido').max(20),
});

export type CreatePoolInput = z.infer<typeof createPoolSchema>;
export type JoinPoolInput = z.infer<typeof joinPoolSchema>;
