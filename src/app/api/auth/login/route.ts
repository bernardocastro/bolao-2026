import { NextResponse } from 'next/server';
import { withErrorHandling, parseBody, ApiError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { loginSchema } from '@/server/auth/auth.dto';
import { authService } from '@/server/auth/auth.service';
import { setAuthCookies } from '@/server/auth/auth.cookies';

export const POST = withErrorHandling(async (req: Request) => {
  const ip = clientIp(req);
  const { allowed } = await rateLimit(`login:${ip}`, 10, 300);
  if (!allowed) throw new ApiError(429, 'Muitas tentativas. Aguarde alguns minutos.');

  const input = await parseBody(req, loginSchema);
  const { user, tokens } = await authService.login(input, {
    ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  const res = NextResponse.json({ user });
  setAuthCookies(res, tokens);
  return res;
});
