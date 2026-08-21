import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { coupleRouter } from './routes/couple.routes';
import { chatRouter } from './routes/chat.routes';
import { communityRouter } from './routes/community.routes';
import { snicksRouter } from './routes/snicks.routes';
import { leaderboardRouter } from './routes/leaderboard.routes';
import { profileRouter } from './routes/profile.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Generous global limit; login/register get a tighter one below.
  app.use(rateLimit({ windowMs: 60_000, limit: 300 }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20 });
  app.use('/api/auth', authLimiter, authRouter);

  app.use('/api/couple', coupleRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/community', communityRouter);
  app.use('/api/snicks', snicksRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/profile', profileRouter);

  app.use(errorHandler);

  return app;
}
