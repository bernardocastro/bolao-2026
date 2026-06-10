import { withErrorHandling, json } from '@/lib/api';
import { requireSession } from '@/lib/session';
import { notificationService } from '@/server/notifications/notification.service';

export const POST = withErrorHandling(async () => {
  const session = await requireSession();
  await notificationService.markAllRead(session.sub);
  return json({ ok: true });
});
