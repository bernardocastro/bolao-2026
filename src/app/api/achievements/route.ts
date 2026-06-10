import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { achievementService } from '@/server/achievements/achievement.service';

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const achievements = await achievementService.forUser(session.sub);
  return json({ achievements });
});
