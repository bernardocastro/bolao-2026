import { z } from 'zod';
import { withErrorHandling, parseBody, json } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import { resultService } from '@/server/matches/result.service';

interface Ctx {
  params: { matchId: string };
}

const resultSchema = z.object({
  homeScore: z.number().int().min(0).max(30),
  awayScore: z.number().int().min(0).max(30),
  status: z.enum(['LIVE', 'FINISHED']).default('FINISHED'),
});

export const POST = withErrorHandling(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const input = await parseBody(req, resultSchema);
  await resultService.setResult({ matchId: params.matchId, ...input });
  return json({ ok: true });
});
