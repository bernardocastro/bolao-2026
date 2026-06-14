import { withErrorHandling, json, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { betService } from '@/server/bets/bet.service';

export const GET = withErrorHandling(async (req: Request, { params }: { params: { matchId: string } }) => {
  const session = await requireSession();
  const poolId = new URL(req.url).searchParams.get('poolId');
  if (!poolId) throw new ApiError(400, 'poolId obrigatório');
  const bets = await betService.listForMatch(session.sub, poolId, params.matchId);
  return json({ bets });
});
