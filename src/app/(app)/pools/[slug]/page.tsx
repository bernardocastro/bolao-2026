import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { poolService } from '@/server/pools/pool.service';
import { PoolDetail } from './pool-detail';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

export default async function PoolPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  let pool;
  try {
    pool = await poolService.getBySlug(session.sub, params.slug);
  } catch {
    notFound();
  }

  return (
    <PoolDetail
      pool={JSON.parse(JSON.stringify(pool))}
      currentUserId={session.sub}
      isAdmin={pool.membership?.role === 'OWNER' || pool.membership?.role === 'ADMIN'}
    />
  );
}
