import { withErrorHandling, parseBody, json, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { joinPoolSchema } from '@/server/pools/pool.dto';
import { poolService } from '@/server/pools/pool.service';

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  const { allowed } = await rateLimit(`join:${session.sub}`, 10, 60);
  if (!allowed) throw new ApiError(429, 'Calma! Muitas tentativas.');
  const { inviteCode } = await parseBody(req, joinPoolSchema);
  const pool = await poolService.join(session.sub, inviteCode);
  return json({ pool });
});
