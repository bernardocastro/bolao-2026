'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socketPromise: Promise<Socket> | null = null;

async function createSocket(): Promise<Socket> {
  let token: string | undefined;
  try {
    const res = await fetch('/api/auth/socket-token');
    if (res.ok) token = ((await res.json()) as { token?: string }).token;
  } catch {
    /* conexão anônima: só rooms públicas */
  }
  return io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001', {
    withCredentials: true,
    transports: ['websocket'],
    ...(token ? { auth: { token } } : {}),
  });
}

function getSocket(): Promise<Socket> {
  socketPromise ??= createSocket();
  return socketPromise;
}

/**
 * Inscreve em um evento Socket.IO com cleanup automático.
 * Rooms: pool:{id} (feed/ranking), user:{id} (notificações), match:{id}.
 */
export function useSocketEvent<T>(
  event: string,
  handler: (payload: T) => void,
  rooms: string[] = [],
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let active = true;
    let socket: Socket | null = null;
    const listener = (payload: T) => handlerRef.current(payload);

    void getSocket().then((s) => {
      if (!active) return;
      socket = s;
      s.on(event, listener);
      if (rooms.length) s.emit('join', rooms);
    });

    return () => {
      active = false;
      if (socket) {
        socket.off(event, listener);
        if (rooms.length) socket.emit('leave', rooms);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, JSON.stringify(rooms)]);
}
