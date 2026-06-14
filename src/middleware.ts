import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/jwt';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
const AUTH_PATHS = ['/login', '/register'];

/**
 * Calls /api/auth/refresh and, on success, returns a NextResponse that:
 *   1. Forwards the new Set-Cookie headers to the browser.
 *   2. Rewrites the request cookie header so RSCs see the fresh access token.
 *
 * Returns null if the refresh token is missing or the refresh fails.
 */
async function tryRefreshMiddleware(req: NextRequest): Promise<NextResponse | null> {
  if (!req.cookies.has('bolao_refresh')) return null;

  try {
    const refreshRes = await fetch(new URL('/api/auth/refresh', req.url), {
      method: 'POST',
      headers: { cookie: req.headers.get('cookie') ?? '' },
    });
    if (!refreshRes.ok) return null;

    // Collect Set-Cookie headers (getSetCookie is available on Node 18+ / Edge)
    const setCookies: string[] =
      typeof (refreshRes.headers as any).getSetCookie === 'function'
        ? (refreshRes.headers as any).getSetCookie()
        : [refreshRes.headers.get('set-cookie') ?? ''].filter(Boolean);

    // Extract the new access token value so RSCs see it in this request
    const accessHeader = setCookies.find((c) => c.startsWith('bolao_access='));
    const newToken = accessHeader?.split(';')[0]?.replace('bolao_access=', '');

    const requestHeaders = new Headers(req.headers);
    if (newToken) {
      const existing = (req.headers.get('cookie') ?? '')
        .split(';')
        .map((c) => c.trim())
        .filter((c) => !c.startsWith('bolao_access='))
        .filter(Boolean)
        .join('; ');
      requestHeaders.set(
        'cookie',
        [newToken ? `bolao_access=${newToken}` : '', existing].filter(Boolean).join('; '),
      );
    }

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    setCookies.forEach((c) => res.headers.append('Set-Cookie', c));
    return res;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('bolao_access')?.value;
  const session = token ? await verifyAccessToken(token) : null;

  // Access expired (or missing) — try to silently refresh before hitting server components
  if (!session) {
    const refreshed = await tryRefreshMiddleware(req);
    if (refreshed) {
      // Refresh succeeded: redirect logged-in users away from auth pages
      if (AUTH_PATHS.includes(pathname)) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      return refreshed;
    }
    // Refresh failed or no refresh cookie — treat as unauthenticated
  }

  // Logged-in users shouldn't see auth screens
  if (session && AUTH_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Protect non-public routes
  const isPublic = PUBLIC_PATHS.includes(pathname);
  if (!session && !isPublic) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only section
  if (pathname.startsWith('/admin') && session?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)).*)'],
};
