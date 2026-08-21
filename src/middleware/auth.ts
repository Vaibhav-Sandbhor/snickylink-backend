import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    coupleId: string | null;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.userId, coupleId: payload.coupleId };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

// Some endpoints (community browsing) work for anyone but personalize if logged in.
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice('Bearer '.length));
      req.auth = { userId: payload.userId, coupleId: payload.coupleId };
    } catch {
      // ignore invalid token, treat as anonymous
    }
  }
  next();
}

// Several features (chat, snicks, leaderboards, profile) only make sense once paired.
export function requireCouple(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth?.coupleId) {
    return res.status(403).json({ error: 'You need to be paired with a partner to access this' });
  }
  next();
}
