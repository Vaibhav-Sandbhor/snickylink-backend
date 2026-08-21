import { v4 as uuid } from 'uuid';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';

function generateInviteCode(): string {
  // short, human-friendly, e.g. "SNICK-7F3K"
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `SNICK-${code}`;
}

export async function createCoupleInvite(userId: string) {
  const existing = await prisma.couple.findFirst({
    where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
  });
  if (existing) throw new ApiError(409, 'You are already paired or have a pending invite');

  const couple = await prisma.couple.create({
    data: {
      id: uuid(),
      userOneId: userId,
      inviteCode: generateInviteCode(),
    },
  });
  return couple;
}

export async function joinCoupleByInviteCode(userId: string, inviteCode: string) {
  const couple = await prisma.couple.findUnique({ where: { inviteCode } });
  if (!couple) throw new ApiError(404, 'Invite code not found');
  if (couple.userTwoId) throw new ApiError(409, 'This invite has already been used');
  if (couple.userOneId === userId) throw new ApiError(400, 'You cannot pair with yourself');

  const alreadyPaired = await prisma.couple.findFirst({
    where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
  });
  if (alreadyPaired) throw new ApiError(409, 'You are already paired with someone');

  const updated = await prisma.couple.update({
    where: { id: couple.id },
    data: { userTwoId: userId },
  });
  return updated;
}

export async function getCoupleForUser(userId: string) {
  return prisma.couple.findFirst({
    where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
    include: { userOne: true, userTwo: true },
  });
}
