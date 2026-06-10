import { withErrorHandling, parseBody, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { poolService } from '@/server/pools/pool.service';
import { z } from 'zod';

interface Ctx {
  params: { poolId: string };
}

export const DELETE = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { userId } = await parseBody(req, z.object({ userId: z.string().cuid() }));
  await poolService.removeMember(session.sub, params.poolId, userId);
  return json({ ok: true });
});
