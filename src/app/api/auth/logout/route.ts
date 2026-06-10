import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withErrorHandling } from '@/lib/api';
import { REFRESH_COOKIE } from '@/lib/session';
import { authService } from '@/server/auth/auth.service';
import { clearAuthCookies } from '@/server/auth/auth.cookies';

export const POST = withErrorHandling(async () => {
  await authService.logout(cookies().get(REFRESH_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
});

// GET: escape hatch para sessões fantasma (token válido, usuário inexistente)
export const GET = withErrorHandling(async () => {
  await authService.logout(cookies().get(REFRESH_COOKIE)?.value);
  const res = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  );
  clearAuthCookies(res);
  return res;
});