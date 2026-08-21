import { v4 as uuid } from 'uuid';
import { prisma } from '../config/prisma';

export async function getMessageHistory(coupleId: string, opts: { cursor?: string; limit?: number }) {
  const limit = Math.min(opts.limit ?? 30, 100);

  const messages = await prisma.message.findMany({
    where: { coupleId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: page.reverse(), // oldest first for chat rendering
    nextCursor: hasMore ? page[0].id : null,
  };
}

export async function saveMessage(coupleId: string, senderId: string, text: string) {
  return prisma.message.create({
    data: { id: uuid(), coupleId, senderId, text },
  });
}

export async function markMessagesRead(coupleId: string, readerId: string) {
  await prisma.message.updateMany({
    where: { coupleId, senderId: { not: readerId }, readAt: null },
    data: { readAt: new Date() },
  });
}
