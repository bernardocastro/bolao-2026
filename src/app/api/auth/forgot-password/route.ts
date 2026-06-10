import { NextResponse } from 'next/server';
import { withErrorHandling, parseBody, ApiError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { forgotPasswordSchema } from '@/server/auth/auth.dto';
import { authService } from '@/server/auth/auth.service';

export const POST = withErrorHandling(async (req: Request) => {
  const { allowed } = await rateLimit(`forgot:${clientIp(req)}`, 3, 600);
  if (!allowed) throw new ApiError(429, 'Muitas tentativas');

  const { email } = await parseBody(req, forgotPasswordSchema);
  const result = await authService.requestPasswordReset(email);
  return NextResponse.json({
    message: 'Se o e-mail existir, enviaremos instruções de recuperação.',
    ...(result.debugToken ? { debugToken: result.debugToken } : {}),
  });
});
