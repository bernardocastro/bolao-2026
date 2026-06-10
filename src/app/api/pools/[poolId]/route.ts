import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { poolService } from '@/server/pools/pool.service';

interface Ctx {
  params: { poolId: string };
}

// poolId aqui é o slug (URLs amigáveis)
export const GET = withErrorHandling(async (_req: Request, { params }: Ctx) => {
  const session = await requireSession();
  const pool = await poolService.getBySlug(session.sub, params.poolId);
  return json({ pool });
});
