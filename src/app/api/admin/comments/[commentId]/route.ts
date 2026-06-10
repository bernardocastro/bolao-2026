import { withErrorHandling, json } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import { prisma } from '@/lib/prisma';

interface Ctx {
  params: { commentId: string };
}

// Moderação: oculta comentário
export const DELETE = withErrorHandling(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  await prisma.comment.update({
    where: { id: params.commentId },
    data: { hiddenAt: new Date() },
  });
  return json({ ok: true });
});
