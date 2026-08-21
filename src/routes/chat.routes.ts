import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAuth, requireCouple } from '../middleware/auth';
import { getMessageHistory, markMessagesRead } from '../services/chat.service';

export const chatRouter = Router();

chatRouter.use(requireAuth, requireCouple);

chatRouter.get(
  '/messages',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await getMessageHistory(req.auth!.coupleId!, { cursor });
    res.json(result);
  })
);

chatRouter.post(
  '/messages/read',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await markMessagesRead(req.auth!.coupleId!, req.auth!.userId);
    res.status(204).send();
  })
);
