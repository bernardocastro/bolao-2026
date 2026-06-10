import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { rankingService } from '@/server/ranking/ranking.service';

export const GET = withErrorHandling(async () => {
  await requireSession();
  const entries = await rankingService.global();
  return json({ entries });
});
