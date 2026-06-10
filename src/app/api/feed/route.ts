import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { feedService } from '@/server/feed/feed.service';

export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  const url = new URL(req.url);
  const result = await feedService.list(session.sub, {
    poolId: url.searchParams.get('poolId') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  });
  return json(result);
});
