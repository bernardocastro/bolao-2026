import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, ArrowRight, Trophy } from 'lucide-react';
import { getSession } from '@/lib/session';
import { poolService } from '@/server/pools/pool.service';
import { matchService } from '@/server/matches/match.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MatchCard, type MatchDTO } from '@/components/features/match-card';
import { KnockoutView } from '@/components/features/knockout-view';
import { formatPoints } from '@/lib/utils';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [pools, upcoming, knockoutMatches] = await Promise.all([
    poolService.listForUser(session.sub),
    matchService.upcoming(3),
    matchService.knockout(),
  ]);

  const knockoutDTOs = knockoutMatches.length
    ? (JSON.parse(JSON.stringify(knockoutMatches)) as MatchDTO[])
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Fala, {session.username}! 👋</h1>
          <p className="text-sm text-muted-foreground">A Copa não espera. Confira seus bolões.</p>
        </div>
        <Button asChild>
          <Link href="/pools/new">
            <Plus className="h-4 w-4" /> Novo bolão
          </Link>
        </Button>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Seus bolões</h2>
        {pools.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nenhum bolão ainda"
            description="Crie o seu ou entre com um código de convite. A resenha começa aqui."
            action={
              <Button asChild>
                <Link href="/pools/new">Criar meu bolão</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pools.map((pool) => {
              const me = pool.members[0];
              return (
                <Link key={pool.id} href={`/pools/${pool.slug}`}>
                  <Card className="transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        {pool.name}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{pool._count.members} participantes</span>
                      <span className="font-semibold text-foreground">
                        {me?.currentRank ? `${me.currentRank}º · ` : ''}
                        {formatPoints(me?.totalPoints ?? 0)} pts
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {knockoutDTOs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Trophy className="h-4 w-4 text-amber-400" />
              Chaveamento
            </h2>
            <Button variant="link" size="sm" asChild>
              <Link href="/matches">Ver palpites</Link>
            </Button>
          </div>
          <KnockoutView initialMatches={knockoutDTOs} />
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Próximos jogos</h2>
          <Button variant="link" size="sm" asChild>
            <Link href="/matches">Ver todos</Link>
          </Button>
        </div>
        <div className="space-y-3">
          {upcoming.map((match) => (
            <MatchCard key={match.id} match={JSON.parse(JSON.stringify(match)) as MatchDTO} />
          ))}
        </div>
      </section>
    </div>
  );
}
