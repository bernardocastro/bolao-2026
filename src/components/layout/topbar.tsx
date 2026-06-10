'use client';

import Link from 'next/link';
import { NotificationsBell } from '@/components/features/notifications-bell';

export function Topbar({ title }: { title?: string }) {
  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between px-4 lg:px-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="font-display text-base font-bold lg:hidden">
          Bolão<span className="text-primary">2026</span>
        </Link>
        {title && <h1 className="hidden font-display text-lg font-semibold lg:block">{title}</h1>}
      </div>
      <NotificationsBell />
    </header>
  );
}
