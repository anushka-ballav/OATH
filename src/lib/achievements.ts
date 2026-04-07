export type AchievementId = 'daily-goal' | 'streak-7' | 'streak-30';

export const ACHIEVEMENTS: Array<{ id: AchievementId; title: string; subtitle: string }> = [
  { id: 'daily-goal', title: 'Daily Hero', subtitle: 'You completed all your daily targets.' },
  { id: 'streak-7', title: '7-Day Streak', subtitle: 'Consistency is now a habit.' },
  { id: 'streak-30', title: '30-Day Streak', subtitle: 'You are in the top 1% of discipline.' },
];

export const normalizeAchievementIds = (value: unknown): AchievementId[] => {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(ACHIEVEMENTS.map((a) => a.id));
  return value.filter((id): id is AchievementId => typeof id === 'string' && allowed.has(id as AchievementId));
};

export const achievementMeta = (id: AchievementId) => ACHIEVEMENTS.find((a) => a.id === id) ?? null;

