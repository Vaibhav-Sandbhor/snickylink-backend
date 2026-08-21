import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { redis } from '../config/redis';
import { saveMessage } from '../services/chat.service';
import { env } from '../config/env';

interface SocketAuth {
  userId: string;
  coupleId: string | null;
}

declare module 'socket.io' {
  interface Socket {
    auth?: SocketAuth;
  }
}

const PRESENCE_TTL_SECONDS = 60;

export function initSockets(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.accessToken as string | undefined;
    if (!token) return next(new Error('Missing access token'));
    try {
      const payload = verifyAccessToken(token);
      socket.auth = { userId: payload.userId, coupleId: payload.coupleId };
      next();
    } catch {
      next(new Error('Invalid access token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const { userId, coupleId } = socket.auth!;

    if (coupleId) {
      socket.join(roomFor(coupleId));
      markPresence(coupleId, userId, true).then(() => {
        io.to(roomFor(coupleId)).emit('presence:update', { userId, online: true });
      });
    }

    socket.on('chat:message', async (payload: { text: string }, ack?: (msg: unknown) => void) => {
      if (!coupleId || typeof payload?.text !== 'string' || !payload.text.trim()) return;
      const message = await saveMessage(coupleId, userId, payload.text.trim());
      io.to(roomFor(coupleId)).emit('chat:message', message);
      ack?.(message);
    });

    socket.on('chat:typing', (isTyping: boolean) => {
      if (!coupleId) return;
      socket.to(roomFor(coupleId)).emit('chat:typing', { userId, isTyping });
    });

    socket.on('chat:read', () => {
      if (!coupleId) return;
      socket.to(roomFor(coupleId)).emit('chat:read', { userId, readAt: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      if (!coupleId) return;
      markPresence(coupleId, userId, false).then(() => {
        io.to(roomFor(coupleId)).emit('presence:update', { userId, online: false });
      });
    });
  });

  return io;
}

function roomFor(coupleId: string) {
  return `couple:${coupleId}`;
}

async function markPresence(coupleId: string, userId: string, online: boolean) {
  const key = `presence:${coupleId}:${userId}`;
  if (online) {
    await redis.set(key, '1', 'EX', PRESENCE_TTL_SECONDS);
  } else {
    await redis.del(key);
  }
}
