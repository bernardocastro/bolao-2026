'use client';

import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { timeAgo, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: NotificationItem[];
  unread: number;
}

export function NotificationsBell() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationsResponse>('/api/notifications'),
  });

  const markAll = useMutation({
    mutationFn: () => api('/api/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unread ?? 0;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="relative rounded-md p-2 transition-colors hover:bg-accent focus:outline-none">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground animate-pulse-ring">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-lg border bg-popover shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Notificações</span>
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={unread === 0}>
              <CheckCheck className="h-3.5 w-3.5" /> Ler todas
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(data?.items ?? []).length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação ainda ⚽
              </p>
            )}
            {(data?.items ?? []).map((n) => (
              <Link
                key={n.id}
                href={n.link ?? '#'}
                className={cn(
                  'block border-b border-border/50 px-4 py-3 transition-colors hover:bg-accent',
                  !n.readAt && 'bg-primary/5',
                )}
              >
                <p className="text-sm font-medium">{n.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
              </Link>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
