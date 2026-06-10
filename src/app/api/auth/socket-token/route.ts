import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { withErrorHandling } from '@/lib/api';
import { requireSession } from '@/lib/session';

/**
 * Em produção o servidor Socket.IO vive em outro domínio, então o cookie
 * httpOnly não é enviado no handshake. Este endpoint emite um token curto
 * (5 min) que o client passa via `auth` na conexão.
 */
export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const token = await new SignJWT({ username: session.username, role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
  return NextResponse.json({ token });
});
