import type { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from '@/lib/session';
import type { AuthTokens } from './auth.service';

export function setAuthCookies(res: NextResponse, tokens: AuthTokens): void {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieOptions, maxAge: 60 * 15 });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: days * 86_400,
    path: '/api/auth',
  });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...cookieOptions, maxAge: 0, path: '/api/auth' });
}
