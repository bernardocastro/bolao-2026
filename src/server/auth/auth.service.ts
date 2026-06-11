import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { ApiError } from '@/lib/api';
import type { LoginInput, PublicUser, RegisterInput } from './auth.dto';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

function toPublicUser(user: {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
}): PublicUser {
  const { id, name, username, email, bio, avatarUrl, role } = user;
  return { id, name, username, email, bio, avatarUrl, role };
}

async function issueTokens(user: { id: string; username: string; role: 'USER' | 'ADMIN' }, meta?: { userAgent?: string; ip?: string }): Promise<AuthTokens> {
  const jti = nanoid();
  const refreshToken = await signRefreshToken({ sub: user.id, jti });
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + days * 86_400_000),
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    },
  });
  const accessToken = await signAccessToken({ sub: user.id, username: user.username, role: user.role });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { username: input.username }] },
      select: { email: true, username: true },
    });
    if (existing?.email === input.email) throw new ApiError(409, 'E-mail já cadastrado');
    if (existing) throw new ApiError(409, 'Username já em uso');

    const user = await prisma.user.create({
      data: {
        name: input.name,
        username: input.username,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        avatarUrl: `https://api.dicebear.com/9.x/thumbs/png?seed=${input.username}`,
      },
    });
    return { user: toPublicUser(user), tokens: await issueTokens(user) };
  },

  async login(input: LoginInput, meta?: { userAgent?: string; ip?: string }): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user?.passwordHash) throw new ApiError(401, 'Credenciais inválidas');
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new ApiError(401, 'Credenciais inválidas');
    return { user: toPublicUser(user), tokens: await issueTokens(user, meta) };
  },

  /** Rotação de refresh token: o antigo é revogado, um novo é emitido. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) throw new ApiError(401, 'Sessão expirada');

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // possível reuso de token → revoga todas as sessões do usuário
      if (stored) {
        await prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new ApiError(401, 'Sessão expirada');
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return { user: toPublicUser(stored.user), tokens: await issueTokens(stored.user) };
  },

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken) },
      data: { revokedAt: new Date() },
    });
  },

  /** Gera token de reset. Em produção, envia por e-mail (SMTP). */
  async requestPasswordReset(email: string): Promise<{ debugToken?: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return {}; // não revela existência do e-mail
    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: sha256(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    // TODO: enviar e-mail via SMTP configurado em .env
    return process.env.NODE_ENV !== 'production' ? { debugToken: token } : {};
  },

  async resetPassword(token: string, password: string): Promise<void> {
    const stored = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new ApiError(400, 'Token inválido ou expirado');
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash: await bcrypt.hash(password, 12) },
      }),
      prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  },

  /** Login/cadastro via Google OAuth. */
  async loginWithGoogle(profile: { googleId: string; email: string; name: string; avatarUrl?: string }): Promise<AuthResult> {
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
    });
    if (!user) {
      const base = profile.email.split('@')[0]!.replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'user';
      let username = base;
      for (let i = 0; await prisma.user.findUnique({ where: { username } }); i++) {
        username = `${base}${i + 1}`;
      }
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          username,
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl ?? `https://api.dicebear.com/9.x/thumbs/png?seed=${username}`,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } });
    }
    return { user: toPublicUser(user), tokens: await issueTokens(user) };
  },
};
