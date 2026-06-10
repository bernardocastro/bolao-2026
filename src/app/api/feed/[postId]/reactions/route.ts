import { z } from 'zod';
import { withErrorHandling, parseBody, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { feedService } from '@/server/feed/feed.service';

interface Ctx {
  params: { postId: string };
}

export const POST = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { emoji } = await parseBody(req, z.object({ emoji: z.string().min(1).max(8) }));
  const result = await feedService.toggleReaction(session.sub, params.postId, emoji);
  return json(result);
});
