import { withErrorHandling, parseBody, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { createPoolSchema } from '@/server/pools/pool.dto';
import { poolService } from '@/server/pools/pool.service';

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const pools = await poolService.listForUser(session.sub);
  return json({ pools });
});

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  const input = await parseBody(req, createPoolSchema);
  const pool = await poolService.create(session.sub, input);
  return json({ pool }, { status: 201 });
});
