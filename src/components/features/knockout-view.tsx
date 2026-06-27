'use client';

import { Fragment } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { MatchDTO } from '@/components/features/match-card';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SLOT_H = 60;   // px — height of one match slot
const COL_W  = 172;  // px — width of one round column
const CONN_W = 36;   // px — width of the SVG connector between columns

// Knockout rounds in bracket order (THIRD_PLACE is rendered separately below)
const BRACKET_STAGES = [
  { key: 'ROUND_OF_32',   label: '16 avos',  count: 16 },
  { key: 'ROUND_OF_16',   label: 'Oitavas',  count: 8  },
  { key: 'QUARTER_FINAL', label: 'Quartas',  count: 4  },
  { key: 'SEMI_FINAL',    label: 'Semi',     count: 2  },
  { key: 'FINAL',         label: 'Final',    count: 1  },
] as const;

// ─── Geometry helpers ─────────────────────────────────────────────────────────
// roundIdx = index into the *displayed* stages array (0 = first visible round)
// slotIdx  = 0-based position within that round

function slotTop(roundIdx: number, slotIdx: number): number {
  const spread = 1 << roundIdx; // 2^roundIdx base-slots per match
  return (spread * slotIdx + (spread - 1) / 2) * SLOT_H;
}

function slotCenterY(roundIdx: number, slotIdx: number): number {
  return slotTop(roundIdx, slotIdx) + SLOT_H / 2;
}

// ─── Placeholder labels ───────────────────────────────────────────────────────
function placeholderLabel(code: string | null | undefined): string {
  if (!code) return '?';
  if (code === '3RD') return '3º melhor';
  const pos = code[0];
  const rest = code.slice(1);
  if ((pos === '1' || pos === '2') && rest) return `${pos}º Gr.${rest}`;
  return '?';
}

// ─── One team row inside a match card ────────────────────────────────────────
const ROW_H = Math.floor((SLOT_H - 5) / 2); // ~25 px

function TeamRow({
  team,
  placeholder,
  score,
  won,
  active,
}: {
  team: MatchDTO['homeTeam'];
  placeholder?: string | null;
  score: number | null;
  won: boolean;
  active: boolean;
}) {
  return (
    <div
      className={cn('flex min-w-0 items-center gap-1.5 px-2', won && 'bg-primary/10')}
      style={{ height: ROW_H }}
    >
      {team ? (
        <Image
          src={team.flagUrl}
          alt={team.code}
          width={16}
          height={11}
          className="shrink-0 rounded-sm object-cover"
        />
      ) : (
        <div className="h-[11px] w-4 shrink-0 rounded-sm bg-muted/50" />
      )}
      <span
        className={cn(
          'flex-1 truncate text-[11px]',
          won
            ? 'font-bold text-foreground'
            : team
            ? 'text-foreground/85'
            : 'text-muted-foreground/40',
        )}
      >
        {team?.code ?? placeholderLabel(placeholder)}
      </span>
      {active && (
        <span
          className={cn(
            'shrink-0 text-[11px] font-black tabular-nums',
            won && 'text-primary',
          )}
        >
          {score ?? '–'}
        </span>
      )}
    </div>
  );
}

// ─── Single match card, absolutely positioned inside its column ───────────────
function BracketMatch({
  match,
  roundIdx,
  slotIdx,
}: {
  match?: MatchDTO;
  roundIdx: number;
  slotIdx: number;
}) {
  const top = slotTop(roundIdx, slotIdx);
  const h   = SLOT_H - 4;

  if (!match) {
    return (
      <div
        className="absolute rounded border border-dashed border-border/20"
        style={{ top: top + 2, left: 0, width: COL_W, height: h }}
      />
    );
  }

  const fin    = match.status === 'FINISHED';
  const live   = match.status === 'LIVE';
  const active = fin || live;
  const hw     = fin && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const aw     = fin && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;

  return (
    <div
      className={cn(
        'absolute overflow-hidden rounded border bg-card',
        live ? 'border-primary/60' : 'border-border',
      )}
      style={{ top: top + 2, left: 0, width: COL_W, height: h }}
    >
      <TeamRow
        team={match.homeTeam}
        placeholder={match.homePlaceholder}
        score={match.homeScore}
        won={hw}
        active={active}
      />
      <div className="border-t border-border/40" />
      <TeamRow
        team={match.awayTeam}
        placeholder={match.awayPlaceholder}
        score={match.awayScore}
        won={aw}
        active={active}
      />
      {live && (
        <div className="absolute right-1.5 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      )}
    </div>
  );
}

// ─── SVG bracket connector between two consecutive rounds ─────────────────────
function Connector({
  fromRoundIdx,
  fromCount,
  bracketH,
}: {
  fromRoundIdx: number;
  fromCount: number;
  bracketH: number;
}) {
  const pairCount = fromCount >> 1;
  const midX      = CONN_W / 2;

  return (
    <svg width={CONN_W} height={bracketH} className="shrink-0">
      {Array.from({ length: pairCount }, (_, k) => {
        const y1 = slotCenterY(fromRoundIdx, k * 2);
        const y2 = slotCenterY(fromRoundIdx, k * 2 + 1);
        const yn = slotCenterY(fromRoundIdx + 1, k);
        return (
          <g key={k}>
            {/* Bracket arms from the two feeder matches */}
            <path
              d={`M 0,${y1} H ${midX} V ${y2} M 0,${y2} H ${midX}`}
              stroke="hsl(var(--border))"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Horizontal lead to the next-round match */}
            <path
              d={`M ${midX},${yn} H ${CONN_W}`}
              stroke="hsl(var(--border))"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ─── Third-place mini card ────────────────────────────────────────────────────
function ThirdPlaceCard({ match }: { match: MatchDTO }) {
  const fin    = match.status === 'FINISHED';
  const live   = match.status === 'LIVE';
  const active = fin || live;
  const hw     = fin && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const aw     = fin && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">
        3º lugar
      </p>
      <div
        className={cn(
          'overflow-hidden rounded-lg border bg-card',
          live ? 'border-primary/60' : 'border-border',
        )}
        style={{ width: COL_W + 60 }}
      >
        <TeamRow
          team={match.homeTeam}
          placeholder={match.homePlaceholder}
          score={match.homeScore}
          won={hw}
          active={active}
        />
        <div className="border-t border-border/40" />
        <TeamRow
          team={match.awayTeam}
          placeholder={match.awayPlaceholder}
          score={match.awayScore}
          won={aw}
          active={active}
        />
      </div>
    </div>
  );
}

// ─── Main bracket view ────────────────────────────────────────────────────────
export function KnockoutView({ poolId: _poolId }: { poolId?: string }) {
  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches', 'knockout'],
    queryFn: () => api<{ matches: MatchDTO[] }>('/api/matches?knockout=true'),
    select: (d) => d.matches,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!matches?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
        <Trophy className="h-10 w-10 opacity-30" />
        <p className="text-sm">As partidas do mata-mata ainda não foram definidas.</p>
        <p className="text-xs">Disponíveis a partir de 28 de junho.</p>
      </div>
    );
  }

  // Group by stage
  const byStage = new Map<string, MatchDTO[]>();
  for (const m of matches) {
    const arr = byStage.get(m.stage) ?? [];
    arr.push(m);
    byStage.set(m.stage, arr);
  }

  const thirdPlace = byStage.get('THIRD_PLACE')?.[0];

  // Start the bracket from the earliest round present in the data
  const firstIdx = BRACKET_STAGES.findIndex((s) => byStage.has(s.key));
  if (firstIdx < 0) return null;

  const stages   = BRACKET_STAGES.slice(firstIdx);
  const bracketH = stages[0]!.count * SLOT_H;
  const totalW   = stages.length * COL_W + (stages.length - 1) * CONN_W;

  return (
    <div className="space-y-6">
      {/* Horizontally scrollable bracket */}
      <div className="-mx-1 overflow-x-auto pb-3">
        <div style={{ width: totalW, padding: '0 4px' }}>

          {/* Round labels */}
          <div className="mb-2 flex" style={{ height: 28 }}>
            {stages.map((stage, idx) => (
              <Fragment key={stage.key}>
                {idx > 0 && <div style={{ width: CONN_W }} />}
                <div className="flex items-center justify-center" style={{ width: COL_W }}>
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-widest',
                      stage.key === 'FINAL'
                        ? 'text-amber-500'
                        : 'text-muted-foreground/60',
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>

          {/* Bracket body */}
          <div className="flex" style={{ height: bracketH }}>
            {stages.map((stage, stageIdx) => {
              const stageMatches = byStage.get(stage.key) ?? [];
              return (
                <Fragment key={stage.key}>
                  {stageIdx > 0 && (
                    <Connector
                      fromRoundIdx={stageIdx - 1}
                      fromCount={stages[stageIdx - 1]!.count}
                      bracketH={bracketH}
                    />
                  )}
                  <div
                    className="relative shrink-0"
                    style={{ width: COL_W, height: bracketH }}
                  >
                    {Array.from({ length: stage.count }, (_, slotIdx) => (
                      <BracketMatch
                        key={slotIdx}
                        match={stageMatches[slotIdx]}
                        roundIdx={stageIdx}
                        slotIdx={slotIdx}
                      />
                    ))}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Third-place match, shown below the bracket */}
      {thirdPlace && <ThirdPlaceCard match={thirdPlace} />}
    </div>
  );
}
