import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ?? new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/** Canais Redis usados como ponte API → servidor Socket.IO */
export const CHANNELS = {
  feed: 'rt:feed',
  ranking: 'rt:ranking',
  notification: 'rt:notification',
  match: 'rt:match',
} as const;

export type RealtimeEvent =
  | { channel: typeof CHANNELS.feed; poolId: string; post: unknown }
  | { channel: typeof CHANNELS.ranking; poolId: string; entries: unknown }
  | { channel: typeof CHANNELS.notification; userId: string; notification: unknown }
  | { channel: typeof CHANNELS.match; matchId: string; payload: unknown };

export async function publishRealtime(event: RealtimeEvent): Promise<void> {
  try {
    await redis.publish(event.channel, JSON.stringify(event));
  } catch {
    // realtime é best-effort: nunca derruba a request
  }
}

/** Cache helper com TTL */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    /* cache indisponível → segue para a fonte */
  }
  const fresh = await fn();
  try {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  } catch {
    /* ignore */
  }
  return fresh;
}

export async function invalidate(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await redis.del(...keys);
  } catch {
    /* ignore */
  }
}
