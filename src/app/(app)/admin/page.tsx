import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { matchService } from '@/server/matches/match.service';
import { AdminMatches } from './admin-matches';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/dashboard');

  const matches = await matchService.list();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Painel Admin</h1>
        <p className="text-sm text-muted-foreground">
          Lance resultados e a pontuação, ranking, feed e conquistas são processados automaticamente.
        </p>
      </div>
      <AdminMatches matches={JSON.parse(JSON.stringify(matches))} />
    </div>
  );
}
