import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { rankingService } from '@/server/ranking/ranking.service';

interface Ctx {
  params: { poolId: string };
}

export const GET = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const session = await requireSession();
  const url = new URL(req.url);
  const entries = await rankingService.forPool(params.poolId);
  const history = url.searchParams.get('history')
    ? await rankingService.history(params.poolId, session.sub)
    : undefined;
  return json({ entries, history });
});
