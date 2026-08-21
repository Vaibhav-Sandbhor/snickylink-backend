import { v4 as uuid } from 'uuid';
import { prisma } from '../config/prisma';
import { ApiError } from '../middleware/errorHandler';
import { levelFromXp } from '../utils/leveling';
import { VerificationMethod } from '@prisma/client';

const PILLAR_BY_MISSION_TYPE: Record<string, 'pillarCommunication' | 'pillarConnection' | 'pillarEffort' | 'pillarTrust'> = {
  daily: 'pillarEffort',
  weekly: 'pillarConnection',
  monthly: 'pillarTrust',
  deep: 'pillarCommunication',
  location: 'pillarConnection',
  emotional: 'pillarCommunication',
};

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Ensures the couple has today's daily/weekly/monthly/deep missions assigned.
// Called lazily whenever the couple opens the Snicks tab.
export async function ensureMissionsAssigned(coupleId: string) {
  const today = startOfDay();

  const existingToday = await prisma.coupleMission.findFirst({
    where: { coupleId, assignedDate: { gte: today } },
  });
  if (existingToday) return;

  const templates = await prisma.missionTemplate.findMany({ where: { active: true } });
  const dailies = templates.filter((t) => t.type === 'daily');
  const weeklies = templates.filter((t) => t.type === 'weekly');
  const monthlies = templates.filter((t) => t.type === 'monthly');
  const deeps = templates.filter((t) => t.type === 'deep');

  const picks: typeof templates = [];
  if (dailies.length) picks.push(...pickRandom(dailies, 2));
  if (weeklies.length && today.getDay() === 1) picks.push(...pickRandom(weeklies, 1));
  if (monthlies.length && today.getDate() === 1) picks.push(...pickRandom(monthlies, 1));
  if (deeps.length) picks.push(...pickRandom(deeps, 1));

  await prisma.coupleMission.createMany({
    data: picks.map((template) => ({
      id: uuid(),
      coupleId,
      missionTemplateId: template.id,
      status: 'active' as const,
      assignedDate: new Date(),
    })),
  });
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function listCoupleMissions(coupleId: string) {
  await ensureMissionsAssigned(coupleId);
  return prisma.coupleMission.findMany({
    where: { coupleId },
    orderBy: { assignedDate: 'desc' },
    include: { missionTemplate: true },
    take: 20,
  });
}

export async function completeMission(
  coupleId: string,
  userId: string,
  coupleMissionId: string,
  method: VerificationMethod,
  payload?: string
) {
  const mission = await prisma.coupleMission.findUnique({
    where: { id: coupleMissionId },
    include: { missionTemplate: true },
  });
  if (!mission || mission.coupleId !== coupleId) throw new ApiError(404, 'Mission not found');
  if (mission.status === 'completed') throw new ApiError(409, 'Mission already completed');
  if (mission.status === 'locked') throw new ApiError(403, 'Mission is locked');

  if (mission.missionTemplate.verification !== method) {
    throw new ApiError(400, `This mission requires verification method: ${mission.missionTemplate.verification}`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.missionCompletionAction.create({
      data: { id: uuid(), coupleMissionId, userId, method, payload },
    });

    await tx.coupleMission.update({
      where: { id: coupleMissionId },
      data: { status: 'completed', completedAt: new Date() },
    });

    const xpReward = mission.missionTemplate.xpReward;
    await tx.xpLog.create({
      data: { id: uuid(), coupleId, userId, amount: xpReward, reason: `Completed: ${mission.missionTemplate.title}` },
    });

    const couple = await tx.couple.findUniqueOrThrow({ where: { id: coupleId } });
    const newXp = couple.xp + xpReward;
    const { level } = levelFromXp(newXp);

    const streak = nextStreak(couple.lastActiveDate, couple.streak);
    const pillarField = PILLAR_BY_MISSION_TYPE[mission.missionTemplate.type] ?? 'pillarEffort';
    const currentPillarValue = (couple as any)[pillarField] as number;
    const bumpedPillar = Math.min(100, currentPillarValue + 2);

    const updated = await tx.couple.update({
      where: { id: coupleId },
      data: {
        xp: newXp,
        level,
        streak,
        lastActiveDate: new Date(),
        [pillarField]: bumpedPillar,
      },
    });

    return { mission, xpAwarded: xpReward, couple: updated };
  });
}

// Streak rules: completing another mission the same day keeps it flat,
// completing one the day after your last activity bumps it by one,
// and any bigger gap resets it back to 1.
function nextStreak(lastActiveDate: Date | null, currentStreak: number): number {
  if (!lastActiveDate) return 1;
  const today = startOfDay();
  const lastDay = startOfDay(lastActiveDate);
  const diffDays = Math.round((today.getTime() - lastDay.getTime()) / 86_400_000);

  if (diffDays === 0) return Math.max(currentStreak, 1);
  if (diffDays === 1) return currentStreak + 1;
  return 1;
}
