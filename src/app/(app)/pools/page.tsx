import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Trophy, Users } from 'lucide-react';
import { getSession } from '@/lib/session';
import { poolService } from '@/server/pools/pool.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { JoinPoolDialog } from './join-pool-dialog';

export const metadata = { title: 'Bolões' };
export const dynamic = 'force-dynamic';

export default async function PoolsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const pools = await poolService.listForUser(session.sub);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Bolões</h1>
        <div className="flex gap-2">
          <JoinPoolDialog />
          <Button asChild>
            <Link href="/pools/new">
              <Plus className="h-4 w-4" /> Criar
            </Link>
          </Button>
        </div>
      </div>

      {pools.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Você ainda não participa de nenhum bolão"
          description="Crie um bolão e convide os amigos, ou entre com um código de convite."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pools.map((pool) => (
            <Link key={pool.id} href={`/pools/${pool.slug}`}>
              <Card className="h-full transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                <CardHeader>
                  <CardTitle className="text-base">{pool.name}</CardTitle>
                  {pool.description && <CardDescription>{pool.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {pool._count.members} participantes
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
