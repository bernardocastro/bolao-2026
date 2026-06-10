import { withErrorHandling, json } from '@/lib/api';
import { matchService } from '@/server/matches/match.service';

export const GET = withErrorHandling(async () => {
  const standings = await matchService.standings();
  return json({ standings });
});
