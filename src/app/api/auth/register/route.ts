import { NextResponse } from 'next/server';
import { withErrorHandling, parseBody, ApiError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { registerSchema } from '@/server/auth/auth.dto';
import { authService } from '@/server/auth/auth.service';
import { setAuthCookies } from '@/server/auth/auth.cookies';

export const POST = withErrorHandling(async (req: Request) => {
  const { allowed } = await rateLimit(`register:${clientIp(req)}`, 5, 600);
  if (!allowed) throw new ApiError(429, 'Muitas tentativas. Tente novamente em alguns minutos.');

  const input = await parseBody(req, registerSchema);
  const { user, tokens } = await authService.register(input);
  const res = NextResponse.json({ user }, { status: 201 });
  setAuthCookies(res, tokens);
  return res;
});
