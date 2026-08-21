import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { env } from '../config/env';

function msFromExpiry(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const [, amountStr, unit] = match;
  const amount = Number(amountStr);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return amount * unitMs;
}

async function issueTokenPair(userId: string, coupleId: string | null) {
  const accessToken = signAccessToken({ userId, coupleId });
  const refreshToken = signRefreshToken(userId);

  await prisma.refreshToken.create({
    data: {
      id: uuid(),
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + msFromExpiry(env.jwt.refreshExpiresIn)),
    },
  });

  return { accessToken, refreshToken };
}

export async function registerUser(email: string, password: string, displayName: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const initials = displayName
    .split(' ')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  const user = await prisma.user.create({
    data: { id: uuid(), email, passwordHash, displayName, avatarInitials: initials },
  });

  const tokens = await issueTokenPair(user.id, null);
  return { user, ...tokens };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { coupleAsUserOne: true, coupleAsUserTwo: true },
  });
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Invalid email or password');

  const coupleId = user.coupleAsUserOne?.id ?? user.coupleAsUserTwo?.id ?? null;
  const tokens = await issueTokenPair(user.id, coupleId);
  return { user, coupleId, ...tokens };
}

export async function refreshSession(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token expired or revoked');
  }

  // rotate: revoke the old one, issue a new pair
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { coupleAsUserOne: true, coupleAsUserTwo: true },
  });
  if (!user) throw new ApiError(401, 'User no longer exists');

  const coupleId = user.coupleAsUserOne?.id ?? user.coupleAsUserTwo?.id ?? null;
  return issueTokenPair(user.id, coupleId);
}

export async function logoutUser(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}
