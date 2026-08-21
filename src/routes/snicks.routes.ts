import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAuth, requireCouple } from '../middleware/auth';
import { completeMission, listCoupleMissions } from '../services/snicks.service';

export const snicksRouter = Router();

snicksRouter.use(requireAuth, requireCouple);

snicksRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const missions = await listCoupleMissions(req.auth!.coupleId!);
    res.json({ missions });
  })
);

const completeSchema = z.object({
  method: z.enum(['self_report', 'photo_upload', 'location_checkin', 'partner_confirm']),
  payload: z.string().optional(),
});

snicksRouter.post(
  '/:missionId/complete',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { method, payload } = completeSchema.parse(req.body);
    const result = await completeMission(
      req.auth!.coupleId!,
      req.auth!.userId,
      req.params.missionId,
      method,
      payload
    );
    res.json(result);
  })
);
