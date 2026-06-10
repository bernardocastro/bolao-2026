import { withErrorHandling, parseBody, json, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { upsertBetSchema } from '@/server/bets/bet.dto';
import { betService } from '@/server/bets/bet.service';

export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  const poolId = new URL(req.url).searchParams.get('poolId');
  if (!poolId) throw new ApiError(400, 'poolId obrigatório');
  const bets = await betService.listForUser(session.sub, poolId);
  return json({ bets });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  const { allowed } = await rateLimit(`bets:${session.sub}`, 60, 60);
  if (!allowed) throw new ApiError(429, 'Muitas requisições');
  const input = await parseBody(req, upsertBetSchema);
  const bet = await betService.upsert(session.sub, input);
  return json({ bet });
});
