import { SignJWT, jwtVerify } from 'jose';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: 'USER' | 'ADMIN';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const accessSecret = () => new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
const refreshSecret = () => new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(process.env.ACCESS_TOKEN_TTL ?? '15m')
    .sign(accessSecret());
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
  return new SignJWT({ jti: payload.jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(refreshSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as 'USER' | 'ADMIN',
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    return { sub: payload.sub as string, jti: payload.jti as string };
  } catch {
    return null;
  }
}
