import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, optionalAuth, requireAuth } from '../middleware/auth';
import {
  addComment,
  createPost,
  listPosts,
  removeVote,
  toggleSavePost,
  voteOnPost,
} from '../services/community.service';

export const communityRouter = Router();

communityRouter.get(
  '/posts',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const tab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await listPosts({ tab, cursor, viewerId: req.auth?.userId });
    res.json(result);
  })
);

const createPostSchema = z.object({
  tag: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  isAnonymous: z.boolean().optional(),
});

communityRouter.post(
  '/posts',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = createPostSchema.parse(req.body);
    const post = await createPost(req.auth!.userId, req.auth!.coupleId, data);
    res.status(201).json({ post });
  })
);

const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });

communityRouter.post(
  '/posts/:postId/vote',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { value } = voteSchema.parse(req.body);
    const vote = await voteOnPost(req.params.postId, req.auth!.userId, value);
    res.json({ vote });
  })
);

communityRouter.delete(
  '/posts/:postId/vote',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await removeVote(req.params.postId, req.auth!.userId);
    res.status(204).send();
  })
);

const commentSchema = z.object({ body: z.string().min(1).max(1000) });

communityRouter.post(
  '/posts/:postId/comments',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { body } = commentSchema.parse(req.body);
    const comment = await addComment(req.params.postId, req.auth!.userId, body);
    res.status(201).json({ comment });
  })
);

communityRouter.post(
  '/posts/:postId/save',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await toggleSavePost(req.params.postId, req.auth!.userId);
    res.json(result);
  })
);
