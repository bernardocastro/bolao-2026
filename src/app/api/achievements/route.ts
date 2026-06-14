import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';

export const GET = withErrorHandling(async () => {
  await requireSession();
  return json({ achievements: [] });
});
