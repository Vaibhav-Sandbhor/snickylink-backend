// Simple escalating XP curve: level N requires N * 250 XP more than the last.
// Level 1 -> 2 needs 250, 2 -> 3 needs 500, etc. Cumulative total to reach level L:
export function xpRequiredForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += i * 250;
  }
  return total;
}

export function levelFromXp(xp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  let level = 1;
  while (xp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }
  const floor = xpRequiredForLevel(level);
  const ceiling = xpRequiredForLevel(level + 1);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNextLevel: ceiling - floor,
  };
}

export function leagueForXp(xp: number): string {
  if (xp >= 5000) return 'Diamond';
  if (xp >= 3000) return 'Gold';
  if (xp >= 1500) return 'Silver';
  return 'Bronze';
}
