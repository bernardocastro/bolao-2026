import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { initials, formatPoints } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: PageProps) {
  return { title: `@${params.username}` };
}

export default async function ProfilePage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { username: params.username },
    include: {
      poolMemberships: {
        include: { pool: { select: { name: true, slug: true } } },
      },
    },
  });
  if (!user) notFound();

  const stats = user.poolMemberships.reduce(
    (acc, m) => ({
      totalPoints: acc.totalPoints + m.totalPoints,
      exactScores: acc.exactScores + m.exactScores,
      correctWinners: acc.correctWinners + m.correctWinners,
    }),
    { totalPoints: 0, exactScores: 0, correctWinners: 0 },
  );

  const STATS = [
    { label: 'Pontos totais', value: formatPoints(stats.totalPoints) },
    { label: 'Placares exatos', value: stats.exactScores },
    { label: 'Resultados certos', value: stats.correctWinners },
    { label: 'Bolões', value: user.poolMemberships.length },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border-2 border-primary/40">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
          <AvatarFallback className="text-xl">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-display text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
          {user.bio && <p className="mt-1 text-sm">{user.bio}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className="font-display text-2xl font-black text-primary">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Bolões</h2>
        <div className="space-y-2">
          {user.poolMemberships.map((m) => (
            <Card key={m.pool.slug}>
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <span className="font-medium">{m.pool.name}</span>
                <span className="text-muted-foreground">
                  {m.currentRank ? `${m.currentRank}º · ` : ''}
                  {formatPoints(m.totalPoints)} pts
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
