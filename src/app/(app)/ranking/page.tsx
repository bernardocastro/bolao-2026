import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { poolService } from '@/server/pools/pool.service';
import { RankingView } from './ranking-view';

export const metadata = { title: 'Ranking' };
export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const pools = await poolService.listForUser(session.sub);

  return (
    <RankingView
      pools={pools.map((p) => ({ id: p.id, name: p.name }))}
      currentUserId={session.sub}
    />
  );
}
