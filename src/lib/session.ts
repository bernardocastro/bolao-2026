import { cookies } from 'next/headers';
import { cache } from 'react';
import { verifyAccessToken, type AccessTokenPayload } from '@/lib/jwt';

export const ACCESS_COOKIE = 'bolao_access';
export const REFRESH_COOKIE = 'bolao_refresh';

const isProd = process.env.NODE_ENV === 'production';

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/',
};

/** Sessão do usuário atual (RSC/Route Handlers). Cacheada por request. */
export const getSession = cache(async (): Promise<AccessTokenPayload | null> => {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
});

export async function requireSession(): Promise<AccessTokenPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireAdmin(): Promise<AccessTokenPayload> {
  const session = await requireSession();
  if (session.role !== 'ADMIN') throw new ForbiddenError();
  return session;
}

export class UnauthorizedError extends Error {
  status = 401 as const;
  constructor() {
    super('Não autenticado');
  }
}

export class ForbiddenError extends Error {
  status = 403 as const;
  constructor() {
    super('Sem permissão');
  }
}
