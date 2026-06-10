'use client';

import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/use-socket';

interface RealtimeNotification {
  title: string;
  body: string;
}

/** Escuta notificações via Socket.IO e exibe toasts; atualiza o sino. */
export function RealtimeNotifications() {
  const queryClient = useQueryClient();

  useSocketEvent<RealtimeNotification>('notification:new', (n) => {
    toast(n.title, { description: n.body });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  return null;
}
