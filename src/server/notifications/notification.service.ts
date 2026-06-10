import { prisma } from '@/lib/prisma';
import { publishRealtime, CHANNELS } from '@/lib/redis';
import type { NotificationType } from '@prisma/client';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export const notificationService = {
  async notify(input: CreateNotificationInput): Promise<void> {
    const notification = await prisma.notification.create({ data: input });
    await publishRealtime({
      channel: CHANNELS.notification,
      userId: input.userId,
      notification,
    });
  },

  async notifyMany(inputs: CreateNotificationInput[]): Promise<void> {
    await Promise.all(inputs.map((i) => this.notify(i)));
  },

  async list(userId: string, cursor?: string) {
    const items = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const nextCursor = items.length > 20 ? items.pop()!.id : null;
    return { items, nextCursor };
  },

  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },
};
