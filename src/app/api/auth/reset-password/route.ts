import { NextResponse } from 'next/server';
import { withErrorHandling, parseBody } from '@/lib/api';
import { resetPasswordSchema } from '@/server/auth/auth.dto';
import { authService } from '@/server/auth/auth.service';

export const POST = withErrorHandling(async (req: Request) => {
  const { token, password } = await parseBody(req, resetPasswordSchema);
  await authService.resetPassword(token, password);
  return NextResponse.json({ message: 'Senha redefinida. Faça login novamente.' });
});
