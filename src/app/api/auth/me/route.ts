import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const GET = withErrorHandling(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, username: true, email: true, bio: true, avatarUrl: true, role: true },
  });
  return NextResponse.json({ user });
});
