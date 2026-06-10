import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { matchService } from '@/server/matches/match.service';
import type { MatchStage } from '@prisma/client';

export const GET = withErrorHandling(async (req: Request) => {
  await requireSession();
  const url = new URL(req.url);
  const stage = url.searchParams.get('stage') as MatchStage | null;
  const round = url.searchParams.get('round');
  const matches = await matchService.list({
    ...(stage ? { stage } : {}),
    ...(round ? { round: Number(round) } : {}),
  });
  return json({ matches });
});
