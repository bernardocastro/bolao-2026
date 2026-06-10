import { withErrorHandling, parseBody, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { updatePoolRulesSchema } from '@/server/pools/pool.dto';
import { poolService } from '@/server/pools/pool.service';

interface Ctx {
  params: { poolId: string };
}

export const PATCH = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const session = await requireSession();
  const rules = await parseBody(req, updatePoolRulesSchema);
  const pool = await poolService.updateRules(session.sub, params.poolId, rules);
  return json({ pool });
});
