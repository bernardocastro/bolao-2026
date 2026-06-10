import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { withErrorHandling, ApiError } from '@/lib/api';
import { cookieOptions } from '@/lib/session';

export const GET = withErrorHandling(async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(501, 'Login com Google não configurado');

  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set('oauth_state', state, { ...cookieOptions, maxAge: 600 });
  return res;
});
