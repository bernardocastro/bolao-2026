import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('1d'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_SOCKET_URL: z.string().default('http://localhost:3001'),
  FOOTBALL_PROVIDER: z.enum(['mock', 'api-football', 'espn']).default('mock'),
  FOOTBALL_API_KEY: z.string().optional(),
  FOOTBALL_API_BASE_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
