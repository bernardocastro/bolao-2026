import { customAlphabet } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { ApiError, NotFoundError } from '@/lib/api';
import { invalidate } from '@/lib/redis';
import { feedService } from '@/server/feed/feed.service';
import { notificationService } from '@/server/notifications/notification.service';
import type { CreatePoolInput } from './pool.dto';

const inviteCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 7);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const poolService = {
  async create(ownerId: string, input: CreatePoolInput) {
    let slug = slugify(input.name);
    if (await prisma.pool.findUnique({ where: { slug } })) {
      slug = `${slug}-${inviteCode().toLowerCase().slice(0, 4)}`;
    }
    const pool = await prisma.pool.create({
      data: {
        ...input,
        slug,
        inviteCode: inviteCode(),
        ownerId,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { name: true } });
    await feedService.publish({
      type: 'POOL_CREATED',
      poolId: pool.id,
      actorId: ownerId,
      content: `${owner.name} criou o bolão "${pool.name}" 🏆`,
    });
    return pool;
  },

  async join(userId: string, code: string) {
    const pool = await prisma.pool.findUnique({
      where: { inviteCode: code.toUpperCase() },
      include: { _count: { select: { members: true } } },
    });
    if (!pool) throw new NotFoundError('Bolão');
    if (pool._count.members >= pool.maxMembers) throw new ApiError(409, 'Bolão lotado');

    const existing = await prisma.poolMember.findUnique({
      where: { poolId_userId: { poolId: pool.id, userId } },
    });
    if (existing) throw new ApiError(409, 'Você já participa deste bolão');

    await prisma.poolMember.create({ data: { poolId: pool.id, userId } });
    await invalidate(`ranking:${pool.id}`);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await feedService.publish({
      type: 'MEMBER_JOINED',
      poolId: pool.id,
      actorId: userId,
      content: `${user.name} entrou no bolão! 👋`,
    });
    await notificationService.notify({
      userId: pool.ownerId,
      type: 'MEMBER_JOINED',
      title: 'Novo participante',
      body: `${user.name} entrou no bolão "${pool.name}"`,
      link: `/pools/${pool.slug}`,
    });
    return pool;
  },

  async listForUser(userId: string) {
    return prisma.pool.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { totalPoints: true, currentRank: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getBySlug(userId: string, slug: string) {
    const pool = await prisma.pool.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, name: true, username: true, avatarUrl: true } },
        _count: { select: { members: true } },
      },
    });
    if (!pool) throw new NotFoundError('Bolão');
    const membership = await prisma.poolMember.findUnique({
      where: { poolId_userId: { poolId: pool.id, userId } },
    });
    if (!membership && pool.isPrivate) throw new ApiError(403, 'Bolão privado');
    return { ...pool, membership };
  },

  async updateRules(userId: string, poolId: string, rules: Partial<CreatePoolInput>) {
    await this.assertAdmin(userId, poolId);
    return prisma.pool.update({ where: { id: poolId }, data: rules });
  },

  async removeMember(actorId: string, poolId: string, targetUserId: string) {
    await this.assertAdmin(actorId, poolId);
    const target = await prisma.poolMember.findUnique({
      where: { poolId_userId: { poolId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundError('Participante');
    if (target.role === 'OWNER') throw new ApiError(403, 'Não é possível remover o dono');
    await prisma.poolMember.delete({ where: { id: target.id } });
    await invalidate(`ranking:${poolId}`);
  },

  async assertAdmin(userId: string, poolId: string): Promise<void> {
    const member = await prisma.poolMember.findUnique({
      where: { poolId_userId: { poolId, userId } },
    });
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      throw new ApiError(403, 'Apenas administradores do bolão');
    }
  },
};
