import { z } from 'zod';
import { withErrorHandling, parseBody, json, ApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import { resultService } from '@/server/matches/result.service';
import { prisma } from '@/lib/prisma';

interface Ctx {
  params: { matchId: string };
}

const resultSchema = z.object({
  homeScore: z.number().int().min(0).max(30),
  awayScore: z.number().int().min(0).max(30),
  status: z.enum(['LIVE', 'FINISHED']).default('FINISHED'),
});

const patchSchema = z.object({
  status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED']),
});

export const POST = withErrorHandling(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const input = await parseBody(req, resultSchema);
  await resultService.setResult({ matchId: params.matchId, ...input });
  return json({ ok: true });
});

/** Force-update match status without re-scoring. Use to fix stuck LIVE matches. */
export const PATCH = withErrorHandling(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { status } = await parseBody(req, patchSchema);
  const match = await prisma.match.findUnique({ where: { id: params.matchId } });
  if (!match) throw new ApiError(404, 'Partida não encontrada');
  await prisma.match.update({ where: { id: params.matchId }, data: { status } });
  return json({ ok: true, matchId: params.matchId, status });
});
