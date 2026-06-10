import { z } from 'zod';
import { withErrorHandling, parseBody, json, ApiError } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { feedService } from '@/server/feed/feed.service';

interface Ctx {
  params: { postId: string };
}

export const GET = withErrorHandling(async (_req: Request, { params }: Ctx) => {
  await requireSession();
  const comments = await feedService.listComments(params.postId);
  return json({ comments });
});

const commentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comentário vazio')
    .max(500)
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, 'Comentário vazio'),
});

export const POST = withErrorHandling(async (req: Request, { params }: Ctx) => {
  const session = await requireSession();
  // anti-spam: 10 comentários por minuto
  const { allowed } = await rateLimit(`comment:${session.sub}`, 10, 60);
  if (!allowed) throw new ApiError(429, 'Devagar! Muitos comentários.');
  const { content } = await parseBody(req, commentSchema);
  const comment = await feedService.addComment(session.sub, params.postId, content);
  return json({ comment }, { status: 201 });
});
