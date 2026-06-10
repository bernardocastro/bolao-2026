import { prisma } from '@/lib/prisma';
import { publishRealtime, CHANNELS } from '@/lib/redis';
import { ApiError, NotFoundError } from '@/lib/api';
import type { FeedPostType, Prisma } from '@prisma/client';

const postInclude = {
  actor: { select: { id: true, name: true, username: true, avatarUrl: true } },
  _count: { select: { comments: { where: { hiddenAt: null } }, reactions: true } },
  reactions: { select: { emoji: true, userId: true } },
} satisfies Prisma.FeedPostInclude;

export type FeedPostWithRelations = Prisma.FeedPostGetPayload<{ include: typeof postInclude }>;

export const feedService = {
  /** Cria evento de feed e publica em tempo real. */
  async publish(input: {
    type: FeedPostType;
    poolId: string;
    actorId?: string;
    content: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    const post = await prisma.feedPost.create({
      data: input,
      include: postInclude,
    });
    await publishRealtime({ channel: CHANNELS.feed, poolId: input.poolId, post });
  },

  /** Feed paginado (cursor) dos bolões do usuário ou de um bolão específico. */
  async list(userId: string, opts: { poolId?: string; cursor?: string }) {
    const where: Prisma.FeedPostWhereInput = opts.poolId
      ? { poolId: opts.poolId, pool: { members: { some: { userId } } } }
      : { pool: { members: { some: { userId } } } };

    const items = await prisma.feedPost.findMany({
      where,
      include: { ...postInclude, pool: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 16,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const nextCursor = items.length > 15 ? items.pop()!.id : null;
    return { items, nextCursor };
  },

  async toggleReaction(userId: string, postId: string, emoji: string) {
    const allowed = ['🔥', '⚽', '😂', '👏', '❤️', '😱'];
    if (!allowed.includes(emoji)) throw new ApiError(400, 'Emoji não suportado');

    const existing = await prisma.reaction.findUnique({
      where: { postId_userId_emoji: { postId, userId, emoji } },
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
      return { reacted: false };
    }
    await prisma.reaction.create({ data: { postId, userId, emoji } });
    return { reacted: true };
  },

  async addComment(userId: string, postId: string, content: string) {
    const post = await prisma.feedPost.findUnique({ where: { id: postId }, select: { poolId: true } });
    if (!post) throw new NotFoundError('Post');
    const membership = await prisma.poolMember.findUnique({
      where: { poolId_userId: { poolId: post.poolId, userId } },
    });
    if (!membership) throw new ApiError(403, 'Você não participa deste bolão');

    return prisma.comment.create({
      data: { postId, authorId: userId, content },
      include: { author: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    });
  },

  async listComments(postId: string) {
    return prisma.comment.findMany({
      where: { postId, hiddenAt: null },
      include: { author: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  },
};
