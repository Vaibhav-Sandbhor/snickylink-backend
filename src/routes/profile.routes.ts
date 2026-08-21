import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAuth, requireCouple } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { levelFromXp } from '../utils/leveling';

export const profileRouter = Router();

profileRouter.use(requireAuth, requireCouple);

profileRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const couple = await prisma.couple.findUnique({
      where: { id: req.auth!.coupleId! },
      include: { userOne: true, userTwo: true },
    });
    if (!couple) throw new ApiError(404, 'Couple not found');

    const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(couple.xp);

    res.json({
      coupleName: couple.coupleName,
      since: couple.createdAt,
      anniversaryDate: couple.anniversaryDate,
      theme: couple.theme,
      level,
      xp: couple.xp,
      xpIntoLevel,
      xpForNextLevel,
      streak: couple.streak,
      pillars: {
        communication: couple.pillarCommunication,
        connection: couple.pillarConnection,
        effort: couple.pillarEffort,
        trust: couple.pillarTrust,
      },
      partners: [
        { id: couple.userOne.id, displayName: couple.userOne.displayName, avatarInitials: couple.userOne.avatarInitials },
        ...(couple.userTwo
          ? [{ id: couple.userTwo.id, displayName: couple.userTwo.displayName, avatarInitials: couple.userTwo.avatarInitials }]
          : []),
      ],
    });
  })
);

const settingsSchema = z.object({
  coupleName: z.string().min(1).max(60).optional(),
  theme: z.enum(['light', 'night']).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
});

profileRouter.patch(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = settingsSchema.parse(req.body);
    const couple = await prisma.couple.update({
      where: { id: req.auth!.coupleId! },
      data,
    });
    res.json({ couple });
  })
);
