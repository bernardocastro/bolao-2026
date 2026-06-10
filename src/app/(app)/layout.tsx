import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Topbar } from '@/components/layout/topbar';
import { RealtimeNotifications } from '@/components/features/realtime-notifications';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) {
    const exists = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true },
    });
    if (!exists) redirect('/api/auth/logout'); // limpa cookies e volta ao login
  }

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-60">
        <Topbar />
        <main className="container max-w-5xl pb-24 pt-6 lg:pb-12">{children}</main>
      </div>
      <MobileNav />
      <RealtimeNotifications />
    </div>
  );
}