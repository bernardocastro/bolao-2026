import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withErrorHandling, ApiError } from '@/lib/api';
import { authService } from '@/server/auth/auth.service';
import { setAuthCookies } from '@/server/auth/auth.cookies';

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies().get('oauth_state')?.value;
  if (!code || !state || state !== storedState) {
    throw new ApiError(400, 'Estado OAuth inválido');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw new ApiError(401, 'Falha na autenticação Google');
  const { access_token } = (await tokenRes.json()) as GoogleTokenResponse;

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) throw new ApiError(401, 'Falha ao obter perfil Google');
  const profile = (await userRes.json()) as GoogleUserInfo;

  const { tokens } = await authService.loginWithGoogle({
    googleId: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
  });

  const res = NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL));
  setAuthCookies(res, tokens);
  res.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
  return res;
});
