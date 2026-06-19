import bcrypt from 'bcryptjs';
import { withErrorHandling, parseBody, json, ApiError } from '@/lib/api';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

async function authorize(req: Request): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const queryOk = Boolean(secret) && url.searchParams.get('secret') === secret;
  const headerOk = Boolean(secret) && req.headers.get('x-cron-secret') === secret;
  const bearerOk = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
  if (queryOk || headerOk || bearerOk) return;
  const session = await getSession();
  if (session?.role !== 'ADMIN') throw new ApiError(401, 'Não autorizado');
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const POST = withErrorHandling(async (req: Request) => {
  await authorize(req);
  const { email, password } = await parseBody(req, schema);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (!user) throw new ApiError(404, 'Usuário não encontrado');

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });

  // Revoke all active sessions so the user must log in again with the new password
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return json({ ok: true, user: user.name, email: user.email });
});
