import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/jwt';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
const AUTH_PATHS = ['/login', '/register'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('bolao_access')?.value;
  const session = token ? await verifyAccessToken(token) : null;

  // usuário logado não vê telas de auth
  if (session && AUTH_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // rotas protegidas
  const isPublic = PUBLIC_PATHS.includes(pathname);
  if (!session && !isPublic) {
    const hasRefresh = req.cookies.has('bolao_refresh');
    if (hasRefresh) {
      // deixa passar: o client tenta /api/auth/refresh e re-renderiza
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // admin
  if (pathname.startsWith('/admin') && session?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)).*)'],
};
