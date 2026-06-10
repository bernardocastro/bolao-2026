import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { UnauthorizedError, ForbiddenError } from '@/lib/session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  constructor(entity = 'Recurso') {
    super(404, `${entity} não encontrado`);
  }
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/** Envolve route handlers com tratamento de erro consistente. */
export function withErrorHandling<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Dados inválidos', issues: error.flatten().fieldErrors },
          { status: 422 },
        );
      }
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error('[api]', error);
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const body: unknown = await req.json().catch(() => {
    throw new ApiError(400, 'JSON inválido');
  });
  return schema.parse(body);
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}
