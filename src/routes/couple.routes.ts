import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { createCoupleInvite, getCoupleForUser, joinCoupleByInviteCode } from '../services/couple.service';
import { signAccessToken } from '../utils/jwt';

export const coupleRouter = Router();

coupleRouter.use(requireAuth);

coupleRouter.post(
  '/invite',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const couple = await createCoupleInvite(req.auth!.userId);
    res.status(201).json({ inviteCode: couple.inviteCode, coupleId: couple.id });
  })
);

const joinSchema = z.object({ inviteCode: z.string().min(1) });

coupleRouter.post(
  '/join',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { inviteCode } = joinSchema.parse(req.body);
    const couple = await joinCoupleByInviteCode(req.auth!.userId, inviteCode);
    // re-issue access token now that this user has a coupleId
    const accessToken = signAccessToken({ userId: req.auth!.userId, coupleId: couple.id });
    res.json({ couple, accessToken });
  })
);

coupleRouter.get(
  '/me',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const couple = await getCoupleForUser(req.auth!.userId);
    res.json({ couple });
  })
);
