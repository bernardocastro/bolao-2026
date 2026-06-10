import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { poolService } from '@/server/pools/pool.service';
import { MatchesView } from './matches-view';

export const metadata = { title: 'Palpites' };
export const dynamic = 'force-dynamic';

export default async function MatchesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const pools = await poolService.listForUser(session.sub);

  return (
    <MatchesView
      pools={pools.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
