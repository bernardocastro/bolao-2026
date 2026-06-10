import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { notificationService } from '@/server/notifications/notification.service';

export const GET = withErrorHandling(async (req: Request) => {
  const session = await requireSession();
  const cursor = new URL(req.url).searchParams.get('cursor') ?? undefined;
  const [result, unread] = await Promise.all([
    notificationService.list(session.sub, cursor),
    notificationService.unreadCount(session.sub),
  ]);
  return json({ ...result, unread });
});
