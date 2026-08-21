import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAuth, requireCouple } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { getLeaderboard } from '../services/leaderboard.service';

export const leaderboardRouter = Router();

leaderboardRouter.use(requireAuth, requireCouple);

leaderboardRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const scope = (req.query.scope as string) ?? 'city'; // local|city|country|global -> map local/city together
    const timeframe = (req.query.timeframe as string) ?? 'week';
    const normalizedScope = scope === 'local' ? 'city' : (scope as 'city' | 'country' | 'global');

    const couple = await prisma.couple.findUnique({ where: { id: req.auth!.coupleId! } });

    const rows = await getLeaderboard({
      scope: normalizedScope,
      timeframe: timeframe as 'week' | 'month' | 'alltime',
      city: couple?.city ?? undefined,
      country: couple?.country ?? undefined,
      viewerCoupleId: req.auth!.coupleId!,
    });

    res.json({ scope: normalizedScope, timeframe, rows });
  })
);
