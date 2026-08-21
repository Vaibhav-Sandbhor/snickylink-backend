import { prisma } from '../config/prisma';
import { leagueForXp } from '../utils/leveling';

type Scope = 'city' | 'country' | 'global';
type Timeframe = 'week' | 'month' | 'alltime';

function timeframeStart(timeframe: Timeframe): Date | undefined {
  const now = new Date();
  if (timeframe === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (timeframe === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return undefined; // alltime
}

export async function getLeaderboard(opts: { scope: Scope; timeframe: Timeframe; city?: string; country?: string; viewerCoupleId?: string }) {
  const since = timeframeStart(opts.timeframe);

  if (!since) {
    // all-time: rank directly by the couple's stored xp total
    const where =
      opts.scope === 'city' && opts.city
        ? { city: opts.city }
        : opts.scope === 'country' && opts.country
        ? { country: opts.country }
        : {};

    const couples = await prisma.couple.findMany({
      where,
      orderBy: { xp: 'desc' },
      take: 100,
      select: { id: true, coupleName: true, xp: true, level: true, city: true, country: true },
    });

    return buildRows(couples, opts.viewerCoupleId);
  }

  // week/month: rank by XP earned within the window, via XpLog aggregation
  const logs = await prisma.xpLog.groupBy({
    by: ['coupleId'],
    where: { createdAt: { gte: since } },
    _sum: { amount: true },
  });

  const coupleIds = logs.map((l) => l.coupleId);
  const couples = await prisma.couple.findMany({
    where: {
      id: { in: coupleIds },
      ...(opts.scope === 'city' && opts.city ? { city: opts.city } : {}),
      ...(opts.scope === 'country' && opts.country ? { country: opts.country } : {}),
    },
    select: { id: true, coupleName: true, level: true, city: true, country: true },
  });

  const xpByCouple = new Map(logs.map((l) => [l.coupleId, l._sum.amount ?? 0]));
  const merged = couples
    .map((c) => ({ ...c, xp: xpByCouple.get(c.id) ?? 0 }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 100);

  return buildRows(merged, opts.viewerCoupleId);
}

function buildRows(
  couples: { id: string; coupleName: string; xp: number; level: number; city: string | null; country: string | null }[],
  viewerCoupleId?: string
) {
  return couples.map((c, index) => ({
    rank: index + 1,
    coupleId: c.id,
    name: c.coupleName,
    level: c.level,
    xp: c.xp,
    league: leagueForXp(c.xp),
    isViewer: c.id === viewerCoupleId,
  }));
}
