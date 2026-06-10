/**
 * Servidor Socket.IO standalone.
 * A API Next publica eventos no Redis (pub/sub); este servidor
 * faz fan-out para os clients conectados nas rooms corretas.
 *
 * Rooms: pool:{poolId} | user:{userId} | match:{matchId}
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { jwtVerify } from 'jose';

const PORT = Number(process.env.PORT ?? process.env.SOCKET_PORT ?? 3001);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const CORS_ORIGIN = (process.env.SOCKET_CORS_ORIGIN ?? 'http://localhost:3000').split(',');

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'bolao-realtime' }));
});

const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
  transports: ['websocket', 'polling'],
});

// ── autenticação do socket via cookie JWT ──
io.use(async (socket, next) => {
  try {
    // 1º: token explícito do handshake (produção, cross-domain);
    // 2º: cookie (dev, mesmo domínio)
    const authToken = (socket.handshake.auth as { token?: string } | undefined)?.token;
    const cookies = socket.handshake.headers.cookie ?? '';
    const cookieToken = /bolao_access=([^;]+)/.exec(cookies)?.[1];
    const token = authToken ?? (cookieToken ? decodeURIComponent(cookieToken) : undefined);
    if (token && process.env.JWT_ACCESS_SECRET) {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.JWT_ACCESS_SECRET),
      );
      socket.data.userId = payload.sub;
    }
    next();
  } catch {
    next(); // permite conexão anônima (somente rooms públicas)
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId as string | undefined;
  if (userId) void socket.join(`user:${userId}`);

  socket.on('join', (rooms: string[]) => {
    for (const room of rooms) {
      // só permite rooms conhecidas; user:* apenas a própria
      if (/^(pool|match):[a-z0-9]+$/i.test(room)) void socket.join(room);
      if (room === `user:${userId}`) void socket.join(room);
    }
  });

  socket.on('leave', (rooms: string[]) => {
    for (const room of rooms) void socket.leave(room);
  });
});

// ── ponte Redis → Socket.IO ──
const sub = new Redis(REDIS_URL);

interface FeedEvent {
  poolId: string;
  post: unknown;
}
interface RankingEvent {
  poolId: string;
  entries: unknown;
}
interface NotificationEvent {
  userId: string;
  notification: unknown;
}
interface MatchEvent {
  matchId: string;
  payload: unknown;
}

void sub.subscribe('rt:feed', 'rt:ranking', 'rt:notification', 'rt:match');

sub.on('message', (channel: string, raw: string) => {
  try {
    const event = JSON.parse(raw) as FeedEvent & RankingEvent & NotificationEvent & MatchEvent;
    switch (channel) {
      case 'rt:feed':
        io.to(`pool:${event.poolId}`).emit('feed:new', event.post);
        break;
      case 'rt:ranking':
        io.to(`pool:${event.poolId}`).emit('ranking:update', { poolId: event.poolId, entries: event.entries });
        break;
      case 'rt:notification':
        io.to(`user:${event.userId}`).emit('notification:new', event.notification);
        break;
      case 'rt:match':
        io.emit('match:update', event.payload);
        break;
    }
  } catch (error) {
    console.error('[realtime] evento inválido', error);
  }
});

httpServer.listen(PORT, () => {
  console.info(`⚡ Realtime server on :${PORT}`);
});
