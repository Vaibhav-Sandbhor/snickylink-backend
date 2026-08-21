import { v4 as uuid } from 'uuid';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

const TAB_TAG_MAP: Record<string, string[] | undefined> = {
  'For you': undefined,
  Following: undefined,
  Stories: ['Stories'],
  'Deep talks': ['Advice', 'Deep Talks'],
};

export async function listPosts(opts: { tab?: string; cursor?: string; limit?: number; viewerId?: string }) {
  const limit = Math.min(opts.limit ?? 20, 50);
  const tagFilter = opts.tab ? TAB_TAG_MAP[opts.tab] : undefined;

  const posts = await prisma.post.findMany({
    where: tagFilter ? { tag: { in: tagFilter } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    include: {
      author: { select: { id: true, displayName: true } },
      _count: { select: { comments: true, votes: true } },
      votes: true,
      savedBy: true,
    },
  });

  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;

  return {
    posts: page.map((post) => ({
      id: post.id,
      author: post.isAnonymous ? 'Anonymous' : post.author.displayName,
      tag: post.tag,
      title: post.title,
      body: post.body,
      createdAt: post.createdAt,
      commentCount: post._count.comments,
      voteCount: post._count.votes,
      viewerVoted: opts.viewerId ? post.votes.some((v) => v.userId === opts.viewerId) : false,
      viewerSaved: opts.viewerId ? post.savedBy.some((s) => s.userId === opts.viewerId) : false,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function createPost(authorId: string, coupleId: string | null, data: { tag: string; title: string; body: string; isAnonymous?: boolean }) {
  return prisma.post.create({
    data: { id: uuid(), authorId, coupleId, ...data },
  });
}

export async function voteOnPost(postId: string, userId: string, value: 1 | -1) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new ApiError(404, 'Post not found');

  return prisma.vote.upsert({
    where: { postId_userId: { postId, userId } },
    create: { id: uuid(), postId, userId, value },
    update: { value },
  });
}

export async function removeVote(postId: string, userId: string) {
  await prisma.vote.deleteMany({ where: { postId, userId } });
}

export async function addComment(postId: string, userId: string, body: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new ApiError(404, 'Post not found');

  return prisma.comment.create({
    data: { id: uuid(), postId, userId, body },
  });
}

export async function toggleSavePost(postId: string, userId: string) {
  const existing = await prisma.savedPost.findUnique({ where: { postId_userId: { postId, userId } } });
  if (existing) {
    await prisma.savedPost.delete({ where: { id: existing.id } });
    return { saved: false };
  }
  await prisma.savedPost.create({ data: { id: uuid(), postId, userId } });
  return { saved: true };
}
