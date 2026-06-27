'use client';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import type { MatchDTO } from '@/components/features/match-card';

interface StandingDTO {
  id: string;
  teamId: string;
  team: { id: string; name: string; code: string; flagUrl: string };
  groupName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function gd(s: StandingDTO): string {
  const diff = s.goalsFor - s.goalsAgainst;
  return diff > 0 ? `+${diff}` : String(diff);
}

export function GroupsView() {
  const { data: standings, isLoading } = useQuery({
    queryKey: ['standings'],
    queryFn: () => api<{ standings: StandingDTO[] }>('/api/standings'),
    select: (d) => d.standings,
  });

  const { data: groupMatches } = useQuery({
    queryKey: ['matches', 'all'],
    queryFn: () => api<{ matches: MatchDTO[] }>('/api/matches?stage=GROUP'),
    select: (d) =>
      d.matches
        .filter((m) => m.groupName !== null)
        .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    );
  }

  const standingsByGroup = new Map<string, StandingDTO[]>();
  for (const s of standings ?? []) {
    const arr = standingsByGroup.get(s.groupName) ?? [];
    arr.push(s);
    standingsByGroup.set(s.groupName, arr);
  }

  const matchesByGroup = new Map<string, MatchDTO[]>();
  for (const m of groupMatches ?? []) {
    if (!m.groupName) continue;
    const arr = matchesByGroup.get(m.groupName) ?? [];
    arr.push(m);
    matchesByGroup.set(m.groupName, arr);
  }

  const sortedGroupNames = [...standingsByGroup.keys()].sort();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sortedGroupNames.map((groupName) => {
        const rows = standingsByGroup.get(groupName)!;
        const matches = matchesByGroup.get(groupName) ?? [];

        return (
          <div key={groupName} className="glass overflow-hidden rounded-lg">
            <div className="bg-primary/10 px-4 py-2">
              <h3 className="text-sm font-bold text-primary">Grupo {groupName}</h3>
            </div>

            {/* Standings table */}
            <div className="px-3 pb-1 pt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="w-4 pb-1 text-left font-normal">#</th>
                    <th className="pb-1 text-left font-normal">Seleção</th>
                    <th className="pb-1 text-center font-normal">J</th>
                    <th className="pb-1 text-center font-normal">V</th>
                    <th className="pb-1 text-center font-normal">E</th>
                    <th className="pb-1 text-center font-normal">D</th>
                    <th className="pb-1 text-center font-normal">SG</th>
                    <th className="pb-1 text-center font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => (
                    <tr
                      key={s.teamId}
                      className={i < 2 ? 'text-foreground' : 'text-muted-foreground'}
                    >
                      <td className="py-0.5 text-muted-foreground">{i + 1}</td>
                      <td className="py-0.5">
                        <div className="flex items-center gap-1.5">
                          {i < 2 && (
                            <span className="h-full w-0.5 rounded-full bg-primary/60 absolute left-0" />
                          )}
                          <Image
                            src={s.team.flagUrl}
                            alt={s.team.code}
                            width={16}
                            height={11}
                            className="rounded-sm object-cover"
                          />
                          <span className="font-semibold">{s.team.code}</span>
                        </div>
                      </td>
                      <td className="py-0.5 text-center">{s.played}</td>
                      <td className="py-0.5 text-center">{s.won}</td>
                      <td className="py-0.5 text-center">{s.drawn}</td>
                      <td className="py-0.5 text-center">{s.lost}</td>
                      <td className="py-0.5 text-center">{gd(s)}</td>
                      <td className="py-0.5 text-center font-black">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Matches */}
            {matches.length > 0 && (
              <div className="space-y-1 border-t border-border/40 px-3 py-2">
                {matches.map((m) => (
                  <div key={m.id} className="flex items-center gap-1 text-xs">
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                      <span className={m.status === 'FINISHED' ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                        {m.homeTeam!.code}
                      </span>
                      <Image
                        src={m.homeTeam!.flagUrl}
                        alt={m.homeTeam!.code}
                        width={14}
                        height={10}
                        className="shrink-0 rounded-sm object-cover"
                      />
                    </div>

                    <div className="w-20 shrink-0 text-center">
                      {m.status === 'SCHEDULED' ? (
                        <span className="text-muted-foreground">{shortDate(m.kickoffAt)}</span>
                      ) : m.status === 'LIVE' ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-black">
                            {m.homeScore} : {m.awayScore}
                          </span>
                          <Badge variant="live" className="px-1 py-0 text-[9px]">
                            ●
                          </Badge>
                        </div>
                      ) : (
                        <span className="font-black">
                          {m.homeScore} – {m.awayScore}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <Image
                        src={m.awayTeam!.flagUrl}
                        alt={m.awayTeam!.code}
                        width={14}
                        height={10}
                        className="shrink-0 rounded-sm object-cover"
                      />
                      <span className={m.status === 'FINISHED' ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                        {m.awayTeam!.code}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
