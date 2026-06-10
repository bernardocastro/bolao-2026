import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withErrorHandling, ApiError } from '@/lib/api';
import { REFRESH_COOKIE } from '@/lib/session';
import { authService } from '@/server/auth/auth.service';
import { setAuthCookies, clearAuthCookies } from '@/server/auth/auth.cookies';

export const POST = withErrorHandling(async () => {
  const refreshToken = cookies().get(REFRESH_COOKIE)?.value;
  if (!refreshToken) throw new ApiError(401, 'Sessão expirada');
  try {
    const { user, tokens } = await authService.refresh(refreshToken);
    const res = NextResponse.json({ user });
    setAuthCookies(res, tokens);
    return res;
  } catch (error) {
    const res = NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
});
