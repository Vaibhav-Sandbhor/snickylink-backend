import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler';
import { loginUser, logoutUser, refreshSession, registerUser } from '../services/auth.service';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(60),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await registerUser(email, password, displayName);
    res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken,
      refreshToken,
    });
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { user, coupleId, accessToken, refreshToken } = await loginUser(email, password);
    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      coupleId,
      accessToken,
      refreshToken,
    });
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const tokens = await refreshSession(refreshToken);
    res.json(tokens);
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await logoutUser(refreshToken);
    res.status(204).send();
  })
);
