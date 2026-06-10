import { withErrorHandling, json, ApiError } from '@/lib/api';
import { getSession } from '@/lib/session';
import { syncService } from '@/server/football/sync.service';

export const maxDuration = 60;

async function authorize(req: Request): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const headerOk = Boolean(secret) && req.headers.get('x-cron-secret') === secret;
  const bearerOk = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
  if (headerOk || bearerOk) return;
  const session = await getSession();
  if (session?.role !== 'ADMIN') throw new ApiError(401, 'Não autorizado');
}

/** POST: worker próprio / cron-job.org · GET: Vercel Cron (Authorization: Bearer CRON_SECRET) */
export const POST = withErrorHandling(async (req: Request) => {
  await authorize(req);
  return json({ summary: await syncService.run() });
});

export const GET = withErrorHandling(async (req: Request) => {
  await authorize(req);
  return json({ summary: await syncService.run() });
});
