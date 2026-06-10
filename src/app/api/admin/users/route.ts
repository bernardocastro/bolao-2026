import { withErrorHandling, json } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const GET = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const users = await prisma.user.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { username: { contains: q } }] }
      : undefined,
    select: { id: true, name: true, username: true, email: true, role: true, createdAt: true },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });
  return json({ users });
});
